import type { Result } from '@linaria/babel-preset'
import fs from 'fs'

type FileEntry = {
  code: string
  map: Result['sourceMap']
  cssText: string
  cssSlug: string
}

type Options = {
  cacheFilePath: string
  viteConfigFilePath: string
  packageJsonPath: string
  packageJsonDependencies: string[]
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
