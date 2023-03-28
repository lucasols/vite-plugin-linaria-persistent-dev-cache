import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createPersistentCache } from '../lib/src/persistentCache'
import { matchValuePattern, valuePatterns } from './utils/matchValuePattern'
import { sleep } from './utils/testUtils'

const version = 3

const mockedFS = new Map<string, string>()

function mockReadFile(path: string) {
  return mockedFS.get(path) || null
}

function mockWriteFile(path: string, data: string) {
  return mockedFS.set(path, data)
}

function addDefaultFiles() {
  mockedFS.set('./vite.config.ts', 'const foo = "bar"')
  mockedFS.set('./pnpm-lock', 'const foo = "bar"')
}

const defaultConfig = {
  cacheFilePath: '.linaria-cache/cache.json',
  viteConfigFilePath: './vite.config.ts',
  lockFilePath: './pnpm-lock',
  _readFile: mockReadFile,
  _writeFile: mockWriteFile,
  _firstWriteDebounce: 10,
  _writeDebounce: 30,
  rootDir: '',
  _getNow: () => new Date('2022-05-16').getTime(),
}

function getCache(cacheFilePath = defaultConfig.cacheFilePath) {
  const cacheFileJSON = mockReadFile(cacheFilePath)

  if (!cacheFileJSON) return null

  return JSON.parse(cacheFileJSON)
}

function viteTransformFile(
  persistentCache: ReturnType<typeof createPersistentCache>,
  fileId: string,
  newCode: string,
  newHash: string,
) {
  const cached = persistentCache.getFile(newHash)

  if (cached) {
    return 'cached'
  }

  persistentCache.addFile(newHash, fileId, {
    code: newCode,
    cssText: 'css',
    map: null,
  })

  return 'addedToCache'
}

beforeEach(() => {
  mockedFS.clear()
})

test('adding cache files', async () => {
  addDefaultFiles()

  const persistentCache = createPersistentCache(defaultConfig)

  persistentCache.addFile('hashfile1', 'file1', {
    code: 'const a = 1',
    cssText: 'css',
    map: null,
  })
  persistentCache.addFile('hashfile2', 'file2', {
    code: 'const a = 2',
    cssText: 'css',
    map: null,
  })
  persistentCache.addFile('hashfile3', 'file3', {
    code: 'const a = 3',
    cssText: 'css',
    map: null,
  })

  expect(getCache()).toMatchInlineSnapshot('null')

  await sleep(12)

  expect(
    matchValuePattern(getCache(), {
      version,
      rootDir: '',
      lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
      viteConfigHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766||',
      results: {
        hashfile1: {
          code: 'const a = 1',
          cssText: 'css',
          fileId: 'file1',
          map: null,
          timestamp: valuePatterns.number,
        },
        hashfile2: {
          code: 'const a = 2',
          cssText: 'css',
          fileId: 'file2',
          map: null,
          timestamp: valuePatterns.number,
        },
        hashfile3: {
          code: 'const a = 3',
          cssText: 'css',
          fileId: 'file3',
          map: null,
          timestamp: valuePatterns.number,
        },
      },
      fileHashes: {
        file1: 'hashfile1',
        file2: 'hashfile2',
        file3: 'hashfile3',
      },
    }),
  ).toEqual(true)

  expect(
    matchValuePattern(persistentCache.getFile('hashfile1'), {
      code: 'const a = 1',
      cssText: 'css',
      fileId: 'file1',
      map: null,
      timestamp: valuePatterns.number,
    }),
  ).toBe(true)
})

describe('clean build cache over time', () => {
  test('remove file after generate a new cache entry', async () => {
    addDefaultFiles()

    mockedFS.set(
      '.linaria-cache/cache.json',
      JSON.stringify({
        version,
        rootDir: '',
        lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
        viteConfigHash:
          '6fee57c71ec34e564ab21fd17da6a1559eb23766||da39a3ee5e6b4b0d3255bfef95601890afd80709',
        results: {
          hashfile1: {
            code: 'const a = 1',
            cssText: 'css',
            fileId: 'file1',
            map: null,
            timestamp: new Date('2022-05-09').getTime(),
          },
          hashfile2: {
            code: 'const a = 2',
            cssText: 'css',
            fileId: 'file2',
            map: null,
            timestamp: new Date('2022-05-09').getTime(),
          },
          hashfile3: {
            code: 'const a = 3',
            cssText: 'css',
            fileId: 'file3',
            map: null,
            timestamp: new Date('2022-05-09').getTime(),
          },
        },
        fileHashes: {
          file1: 'hashfile1',
          file2: 'hashfile2',
          file3: 'hashfile3',
        },
      }),
    )

    const persistentCache = createPersistentCache(defaultConfig)

    const result = viteTransformFile(
      persistentCache,
      'file1',
      'const a = 1',
      'hash1',
    )

    expect(result).toBe('addedToCache')

    await sleep(12)

    expect(
      matchValuePattern(getCache(), {
        version,
        rootDir: '',
        lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
        viteConfigHash:
          '6fee57c71ec34e564ab21fd17da6a1559eb23766||da39a3ee5e6b4b0d3255bfef95601890afd80709',
        results: {
          hashfile2: {
            code: 'const a = 2',
            cssText: 'css',
            fileId: 'file2',
            map: null,
            timestamp: valuePatterns.number,
          },
          hashfile3: {
            code: 'const a = 3',
            cssText: 'css',
            fileId: 'file3',
            map: null,
            timestamp: valuePatterns.number,
          },
          hash1: {
            code: 'const a = 1',
            cssText: 'css',
            fileId: 'file1',
            map: null,
            timestamp: valuePatterns.number,
          },
        },
        fileHashes: {
          file1: 'hash1',
          file2: 'hashfile2',
          file3: 'hashfile3',
        },
      }),
    ).toBe(true)
  })

  test('remove old files', async () => {
    addDefaultFiles()
    mockedFS.set(
      '.linaria-cache/cache.json',
      JSON.stringify({
        version,
        rootDir: '',
        lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
        viteConfigHash:
          '6fee57c71ec34e564ab21fd17da6a1559eb23766||da39a3ee5e6b4b0d3255bfef95601890afd80709',
        results: {
          hashfile1: {
            code: 'const a = 1',
            cssText: 'css',
            fileId: 'file1',
            map: null,
            timestamp: new Date('2000-01-01').getTime(),
          },
          hashfile2: {
            code: 'const a = 2',
            cssText: 'css',
            fileId: 'file2',
            map: null,
            timestamp: new Date('2000-01-01').getTime(),
          },
          hashfile3: {
            code: 'const a = 3',
            cssText: 'css',
            fileId: 'file3',
            map: null,
            timestamp: new Date('2022-05-09').getTime(),
          },
          hashfile4: {
            code: 'const a = 4',
            cssText: 'css',
            fileId: 'file4',
            map: null,
            timestamp: new Date('2022-04-09').getTime(),
          },
          hashfile5: {
            code: 'const a = 5',
            cssText: 'css',
            fileId: 'file5',
            map: null,
            timestamp: new Date('2022-05-12').getTime(),
          },
        },
        fileHashes: {
          file1: 'hashfile1',
          file2: 'hashfile2',
          file3: 'hashfile3',
          file4: 'hashfile4',
          file5: 'hashfile5',
        },
      }),
    )

    const persistentCache = createPersistentCache(defaultConfig)

    const result = viteTransformFile(
      persistentCache,
      'file3',
      'const a = 1',
      'hash3',
    )

    expect(result).toBe('addedToCache')

    await sleep(20)

    expect(
      matchValuePattern(getCache(), {
        version: 3,
        rootDir: '',
        lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
        viteConfigHash:
          '6fee57c71ec34e564ab21fd17da6a1559eb23766||da39a3ee5e6b4b0d3255bfef95601890afd80709',
        results: {
          hash3: {
            code: 'const a = 1',
            cssText: 'css',
            fileId: 'file3',
            map: null,
            timestamp: valuePatterns.number,
          },
          hashfile5: {
            code: 'const a = 5',
            cssText: 'css',
            fileId: 'file5',
            map: null,
            timestamp: valuePatterns.number,
          },
        },
        fileHashes: {
          file3: 'hash3',
          file5: 'hashfile5',
        },
      }),
    ).toBe(true)
  })

  describe('config files change', () => {
    function getPersistentCache() {
      addDefaultFiles()

      mockedFS.set(
        '.linaria-cache/cache.json',
        JSON.stringify({
          version: 3,
          rootDir: '',
          lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
          viteConfigHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766||',
          results: {
            hashfile1: {
              code: 'const a = 1',
              cssText: 'css',
              fileId: 'file1',
              map: null,
              timestamp: new Date('2000-01-01').getTime(),
            },
          },
          fileHashes: {
            file1: 'hashfile1',
          },
        }),
      )

      return createPersistentCache(defaultConfig)
    }

    test('reset cache if lock file changed', async () => {
      const persistentCache = getPersistentCache()

      persistentCache.checkConfigFiles()

      await sleep(20)

      expect(
        matchValuePattern(getCache(), {
          version: 3,
          rootDir: '',
          lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
          viteConfigHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766||',
          results: {
            hashfile1: {
              code: 'const a = 1',
              cssText: 'css',
              fileId: 'file1',
              map: null,
              timestamp: valuePatterns.number,
            },
          },
          fileHashes: {
            file1: 'hashfile1',
          },
        }),
      ).toBe(true)

      // change lock file

      mockedFS.set('./pnpm-lock', 'const foo = "bar2"')

      persistentCache.checkConfigFiles()

      await sleep(20)

      expect(
        matchValuePattern(getCache(), {
          version: 3,
          rootDir: '',
          lockFileHash: '43693d6a2989cc9610ddf229f7a503e92a393b5f',
          viteConfigHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766||',
          results: {},
          fileHashes: {},
        }),
      ).toBe(true)
    })

    test('reset cache if vite config changed', async () => {
      const persistentCache = getPersistentCache()

      mockedFS.set('./vite.config.ts', 'const foo = "bar2"')

      persistentCache.checkConfigFiles()

      await sleep(20)

      expect(
        matchValuePattern(getCache(), {
          version: 3,
          rootDir: '',
          lockFileHash: '6fee57c71ec34e564ab21fd17da6a1559eb23766',
          viteConfigHash: '43693d6a2989cc9610ddf229f7a503e92a393b5f||',
          results: {},
          fileHashes: {},
        }),
      ).toBe(true)
    })
  })
})

test('write debounce', async () => {
  const writeFile = vi.fn(mockWriteFile)

  addDefaultFiles()
  const persistentCache = createPersistentCache({
    ...defaultConfig,
    _writeFile: writeFile,
  })

  persistentCache.addFile('hashfile1', 'file1', {
    code: 'const a = 1',
    cssText: 'css',
    map: null,
  })

  expect(getCache()).toMatchInlineSnapshot('null')

  await sleep(12)

  const cache1 = mockReadFile('.linaria-cache/cache.json')

  expect(getCache()).toBeTruthy()

  persistentCache.addFile('hashfile1', 'file1', {
    code: 'const a = 1',
    cssText: 'css',
    map: null,
  })

  await sleep(12)

  expect(cache1).toBe(mockReadFile('.linaria-cache/cache.json'))

  await sleep(35)

  expect(cache1).not.toBe(mockReadFile('.linaria-cache/cache.json'))

  expect(writeFile).toHaveBeenCalledTimes(2)
})

test.todo('moving a file to another folder should not crash the cache', async () => {}) // não sei se é isso mesmo haha, é issso sim!! mas o problema é no plugin
