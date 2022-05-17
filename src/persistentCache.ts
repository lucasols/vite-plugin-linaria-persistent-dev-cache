import type { Result } from '@linaria/babel-preset'
import fs from 'fs'
import path from 'path'
import { createFileDepHash } from './fileDepHash'
import { generateStringHash } from './utils'

const cacheFormatVersion = 1

interface FileEntry {
  code: string
  map: Result['sourceMap']
  cssText: string
  cssSlug: string
}

interface CacheEntry extends FileEntry {
  timestamp: number
  fileId: string
}

interface CacheFile {
  version: number
  rootDir: string
  lockFileHash: string
  viteConfigHash: string
  results: Record<string, CacheEntry>
  fileHashes: Record<string, string>
}

type Options = {
  cacheFilePath: string
  viteConfigFilePath: string
  lockFilePath: string
  rootDir: string
  debug?: boolean
  _readFile?: (path: string) => string | null
  _writeFile?: (path: string, data: string) => void
  _writeDebounce?: number
  _getNow?: () => number
}

function defaultReadFile(filePath: string): string | null {
  const fileExists = fs.statSync(filePath, {
    throwIfNoEntry: false,
  })

  if (!fileExists) {
    return null
  }

  return fs.readFileSync(filePath, 'utf8')
}

function defaultWriteFile(filePath: string, data: string) {
  const dirname = path.dirname(filePath)

  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }

  fs.writeFile(filePath, data, (err) => {
    if (err) {
      throw err
    }
  })
}

export function createPersistentCache({
  cacheFilePath,
  _readFile = defaultReadFile,
  _writeFile = defaultWriteFile,
  _writeDebounce = 3000,
  lockFilePath,
  rootDir,
  debug,
  viteConfigFilePath,
  _getNow = Date.now,
}: Options) {
  const cacheFileJSON = _readFile(cacheFilePath)

  let updateTimeout: NodeJS.Timeout | null = null

  let persistentCache: CacheFile

  if (cacheFileJSON) {
    persistentCache = JSON.parse(cacheFileJSON)
  } else {
    persistentCache = {
      version: cacheFormatVersion,
      lockFileHash: getLockFileHash(),
      viteConfigHash: getViteConfigHash(),
      results: {},
      fileHashes: {},
      rootDir,
    }
  }

  function debugLog(...args: any[]) {
    if (debug) {
      console.log('[linaria]', ...args)
    }
  }

  function checkConfigFiles() {
    const lockFileHash = getLockFileHash()
    const viteConfigHash = getViteConfigHash()

    debugLog('checking config files')

    if (
      persistentCache.version !== cacheFormatVersion ||
      lockFileHash !== persistentCache.lockFileHash ||
      viteConfigHash !== persistentCache.viteConfigHash
    ) {
      debugLog('cache reseted')

      persistentCache = {
        version: cacheFormatVersion,
        lockFileHash,
        viteConfigHash,
        results: {},
        fileHashes: {},
        rootDir,
      }

      updateCache()
    }
  }

  function getLockFileHash() {
    const resolvedPath = lockFilePath

    const lockFileContent = _readFile(lockFilePath)

    if (!lockFileContent) {
      throw new Error(`Could not read lock file at ${resolvedPath}`)
    }

    return generateStringHash(lockFileContent)
  }

  function getViteConfigHash() {
    const viteConfigContent = _readFile(viteConfigFilePath)

    if (!viteConfigContent) {
      throw new Error(
        `Could not read vite config file at ${viteConfigFilePath}`,
      )
    }

    const fileDepHash = createFileDepHash({
      rootDir,
      aliases: [],
      resolveRelative: true,
      include: [/^\.+/],
      exclude: [],
    })

    return fileDepHash.getHash(viteConfigFilePath, viteConfigContent).hash
  }

  function cacheEntryIsExpired(entry: CacheEntry, now = _getNow()) {
    const timeSinceLastUpdate = now - entry.timestamp

    return timeSinceLastUpdate > 24 * 7 * 60 * 60 * 1000
  }

  function deleteEntry(hash: string, entry: CacheEntry) {
    const fileId = entry.fileId

    delete persistentCache.results[hash]
    delete persistentCache.fileHashes[getFileId(fileId)]
  }

  function deleteOldFiles() {
    const now = _getNow()

    Object.entries(persistentCache.results).forEach(([hash, entry]) => {
      if (cacheEntryIsExpired(entry, now)) {
        deleteEntry(hash, entry)
      }
    })
  }

  function updateCache() {
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }

    updateTimeout = setTimeout(() => {
      deleteOldFiles()

      _writeFile(cacheFilePath, JSON.stringify(persistentCache))
    }, _writeDebounce)
  }

  function compressFileId(fileId: string) {
    return fileId.replace(rootDir, '')
  }

  function getFileId(filePath: string) {
    return `${rootDir}${filePath}`
  }

  function addFile(hash: string, fileId: string, result: FileEntry) {
    const fileIdCompressed = compressFileId(fileId)

    persistentCache.results[hash] = {
      ...result,
      fileId: fileIdCompressed,
      timestamp: _getNow(),
    }

    const previousFileHash = persistentCache.fileHashes[fileIdCompressed]

    if (previousFileHash) {
      delete persistentCache.results[previousFileHash]
    }

    persistentCache.fileHashes[fileIdCompressed] = hash
    updateCache()
  }

  function getFile(hash: string) {
    const result = persistentCache.results[hash]

    if (!result) return null

    if (cacheEntryIsExpired(result)) {
      deleteEntry(hash, result)
      return null
    }

    return result
  }

  return {
    addFile,
    getFile,
    checkConfigFiles,
  }
}
