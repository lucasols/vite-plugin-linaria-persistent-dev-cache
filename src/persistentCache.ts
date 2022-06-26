import fs from 'fs'
import path from 'path'
import { createFileDepHash } from './fileDepHash'
import { generateStringHash } from './utils'

const cacheFormatVersion = 3

interface FileEntry {
  code: string
  map: any
  cssText: string
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
  readonly: boolean | undefined
  debug?: boolean
  _readFile?: (path: string) => string | null
  _writeFile?: (path: string, data: string) => void
  _writeDebounce?: number
  _firstWriteDebounce?: number
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
  _writeDebounce = 1_000 * 60 * 4,
  _firstWriteDebounce = 1_000 * 10,
  lockFilePath,
  rootDir,
  debug,
  readonly,
  viteConfigFilePath,
  _getNow = Date.now,
}: Options) {
  let debounce = _firstWriteDebounce

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

    let resetCache = false
    let resetReason: string | null = null

    if (persistentCache.version !== cacheFormatVersion) {
      resetCache = true
      resetReason = `cache format version changed from ${persistentCache.version} to ${cacheFormatVersion}`
    }

    if (!resetCache && persistentCache.lockFileHash !== lockFileHash) {
      resetCache = true
      resetReason = `lock file hash changed`
    }

    if (!resetCache && persistentCache.viteConfigHash !== viteConfigHash) {
      resetCache = true
      resetReason = `vite config file hash changed`
    }

    if (resetCache) {
      console.log(`[linaria] Dev cache reseted: ${resetReason}`)

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
    if (readonly) return

    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }

    updateTimeout = setTimeout(() => {
      debounce = _writeDebounce

      deleteOldFiles()

      const content = JSON.stringify(persistentCache)

      _writeFile(cacheFilePath, content)

      if (debug) {
        debugLog('write new cache version, length', content.length)
      }
    }, debounce)
  }

  function compressFileId(fileId: string) {
    return fileId.replace(rootDir, '')
  }

  function getFileId(filePath: string) {
    return `${rootDir}${filePath}`
  }

  function addFile(hash: string, fileId: string, result: FileEntry) {
    if (readonly) return

    const fileIdCompressed = compressFileId(fileId)

    persistentCache.results[hash] = {
      ...result,
      fileId: fileIdCompressed,
      timestamp: _getNow(),
    }

    const previousFileHash = persistentCache.fileHashes[fileIdCompressed]

    if (previousFileHash) {
      debugLog('delete previous', fileIdCompressed)
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
