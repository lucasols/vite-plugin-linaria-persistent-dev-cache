import type { Result } from '@linaria/babel-preset'
import fs from 'fs'
import path from 'path'
import { createFileDepHash } from './fileDepHash'
import { generateStringHash } from './utils'

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
  _readFile?: (path: string) => string | null
  _writeFile?: (path: string, data: string) => void
  _writeDebounce?: number
  _getNow?: () => number
}

function defaultReadFile(path: string): string | null {
  const fileExists = fs.statSync(path, {
    throwIfNoEntry: false,
  })

  if (!fileExists) {
    return null
  }

  return fs.readFileSync(path, 'utf8')
}

function defaultWriteFile(path: string, data: string) {
  fs.writeFile(path, data, (err) => {
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
      lockFileHash: getLockFileHash(),
      viteConfigHash: getViteConfigHash(),
      results: {},
      fileHashes: {},
    }
  }

  function checkConfigFiles() {
    const lockFileHash = getLockFileHash()
    const viteConfigHash = getViteConfigHash()

    if (
      lockFileHash !== persistentCache.lockFileHash ||
      viteConfigHash !== persistentCache.viteConfigHash
    ) {
      persistentCache.viteConfigHash = viteConfigHash
      persistentCache.lockFileHash = lockFileHash
      persistentCache.results = {}
      persistentCache.fileHashes = {}

      updateCache()
    }
  }

  function getLockFileHash() {
    const lockFileContent = _readFile(lockFilePath)

    if (!lockFileContent) {
      throw new Error(`Could not read lock file at ${lockFilePath}`)
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

    return fileDepHash.getHash(
      path.resolve(rootDir, viteConfigFilePath),
      viteConfigContent,
    ).hash
  }

  function deleteOldFiles() {
    const now = _getNow()

    Object.entries(persistentCache.results).forEach(([hash, entry]) => {
      const timeSinceLastUpdate = now - entry.timestamp

      if (timeSinceLastUpdate > 24 * 7 * 60 * 60 * 1000) {
        const fileId = entry.fileId

        delete persistentCache.results[hash]
        delete persistentCache.fileHashes[fileId]
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

  function addFile(hash: string, fileId: string, result: FileEntry) {
    persistentCache.results[hash] = {
      ...result,
      fileId,
      timestamp: _getNow(),
    }

    const previousFileHash = persistentCache.fileHashes[fileId]

    if (previousFileHash) {
      delete persistentCache.results[previousFileHash]
    }

    persistentCache.fileHashes[fileId] = hash
    updateCache()
  }

  function getFile(hash: string) {
    return persistentCache.results[hash]
  }

  return {
    addFile,
    getFile,
    checkConfigFiles,
  }
}
