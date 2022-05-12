import type { Result } from '@linaria/babel-preset'
import fs from 'fs'

interface FileEntry {
  code: string
  map: Result['sourceMap']
  cssText: string
  cssSlug: string
}

interface CacheEntry extends FileEntry {
  fileId: string
  timestamp: number
}

interface CacheFile {
  results: CacheEntry[]
}

type Options = {
  cacheFilePath: string
  viteConfigFilePath: string
  lockFilePath: string
}

export function createPersistentCache({ cacheFilePath }: Options) {
  const cacheFileExists = fs.statSync(cacheFilePath, {
    throwIfNoEntry: false,
  })

  let updateTimeout: NodeJS.Timeout | null = null

  const persistentCache: Record<string, FileEntry> = cacheFileExists
    ? JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'))
    : {}

  function updateCache() {
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }

    updateTimeout = setTimeout(() => {
      fs.writeFile(cacheFilePath, JSON.stringify(persistentCache), () => {})
    }, 3000)
  }

  function addFile(hash: string, file: FileEntry) {
    persistentCache[hash] = file
    updateCache()
  }

  function getFile(hash: string) {
    return persistentCache[hash]
  }

  function removeFile(fileId: string) {
    // FIX: remove file deps?
    delete persistentCache[hash]
    updateCache()
  }

  return {
    addFile,
    getFile,
    removeFile,
  }
}
