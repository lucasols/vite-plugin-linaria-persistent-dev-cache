import path from 'path'
import { beforeEach, describe, expect, test } from 'vitest'
import { testOnly } from '../src/fileDepHash'
import { getSortedCodeDepsCache } from './utils/getSortedImports'
import { createFileDeepHashInstance, getFileDepHash } from './utils/setup'

const root = `${__dirname}/__mocks__/public/`

const fileDepHash = createFileDeepHashInstance(root)

function getPublicFileDepHash(file: string) {
  return getFileDepHash(file, root, fileDepHash)
}

export function getFileId(file: string) {
  return path.posix.join(root, file)
}

function getSimplifiedSortedCodeDepsCache() {
  return getSortedCodeDepsCache(root + 'src/', fileDepHash)
}

test('invalidates cache of file', () => {
  fileDepHash.resetCache()

  const result = getPublicFileDepHash('./src/simple5/Dropdown.ts')

  expect(result.importsMap.length).toEqual(6)

  fileDepHash.cleanCacheForFile(getFileId('./src/simple5/PortalLayer.ts'))
  fileDepHash.cleanCacheForFile(getFileId('./src/simple5/PortalLayer.ts'))

  expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
    [
      {
        "fileId": "simple5/typings.ts",
        "imports": [],
      },
      {
        "fileId": "simple5/useDelayValueUpdate.ts",
        "imports": [
          "simple5/typings.ts",
          "simple5/useTimeout.ts",
        ],
      },
      {
        "fileId": "simple5/useOnClickOutiside.ts",
        "imports": [],
      },
      {
        "fileId": "simple5/useTimeout.ts",
        "imports": [
          "simple5/typings.ts",
        ],
      },
    ]
  `)
})

test('invalidates cache of a file with circular dependency', () => {
  fileDepHash.resetCache()

  const result = getPublicFileDepHash('./src/circular3/dep1.ts')

  expect(result.importsMap.length).toEqual(4)

  fileDepHash.cleanCacheForFile(getFileId('./src/circular3/dep5.ts'))
  fileDepHash.cleanCacheForFile(getFileId('./src/circular3/dep5.ts'))

  expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
    [
      {
        "fileId": "circular3/dep2.ts",
        "imports": false,
      },
      {
        "fileId": "circular3/dep3.tsx",
        "imports": false,
      },
      {
        "fileId": "circular3/dep4.ts",
        "imports": false,
      },
    ]
  `)
})

describe('emulate vite behaviour', () => {
  function emulateViteTransform(file: string) {
    fileDepHash.cleanCacheForFile(getFileId(file))
    getPublicFileDepHash(file)
  }

  const cache = [
    {
      fileId: 'simple5/Dropdown.ts',
      imports: [
        'simple5/Popover.ts',
        'simple5/PortalLayer.ts',
        'simple5/typings.ts',
        'simple5/useDelayValueUpdate.ts',
        'simple5/useOnClickOutiside.ts',
        'simple5/useTimeout.ts',
      ],
    },
    {
      fileId: 'simple5/Popover.ts',
      imports: ['simple5/PortalLayer.ts'],
    },
    {
      fileId: 'simple5/PortalLayer.ts',
      imports: [],
    },
    {
      fileId: 'simple5/typings.ts',
      imports: [],
    },
    {
      fileId: 'simple5/useDelayValueUpdate.ts',
      imports: ['simple5/typings.ts', 'simple5/useTimeout.ts'],
    },
    {
      fileId: 'simple5/useOnClickOutiside.ts',
      imports: [],
    },
    {
      fileId: 'simple5/useTimeout.ts',
      imports: ['simple5/typings.ts'],
    },
  ]

  test('vite first build', () => {
    fileDepHash.resetCache()

    emulateViteTransform('./src/simple5/Dropdown.ts')

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual(cache)

    emulateViteTransform('./src/simple5/Popover.ts')
    emulateViteTransform('./src/simple5/PortalLayer.ts')
    emulateViteTransform('./src/simple5/typings.ts')
    emulateViteTransform('./src/simple5/useDelayValueUpdate.ts')
    emulateViteTransform('./src/simple5/useTimeout.ts')
    emulateViteTransform('./src/simple5/useOnClickOutiside.ts')

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual(cache)
  })

  test('update file useOnClickOutiside.ts', () => {
    emulateViteTransform('./src/simple5/useOnClickOutiside.ts')

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual([
      {
        fileId: 'simple5/Popover.ts',
        imports: ['simple5/PortalLayer.ts'],
      },
      {
        fileId: 'simple5/PortalLayer.ts',
        imports: [],
      },
      {
        fileId: 'simple5/typings.ts',
        imports: [],
      },
      {
        fileId: 'simple5/useDelayValueUpdate.ts',
        imports: ['simple5/typings.ts', 'simple5/useTimeout.ts'],
      },
      {
        fileId: 'simple5/useOnClickOutiside.ts',
        imports: [],
      },
      {
        fileId: 'simple5/useTimeout.ts',
        imports: ['simple5/typings.ts'],
      },
    ])

    emulateViteTransform('./src/simple5/Dropdown.ts')

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual(cache)
  })

  test('after a time access lazy route', () => {
    emulateViteTransform('./src/base/base.tsx')
    emulateViteTransform('./src/base/dep1.ts')
    emulateViteTransform('./src/base/dep2.ts')

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual([
      {
        fileId: 'base/base.tsx',
        imports: ['base/dep1.ts', 'base/dep2.ts'],
      },
      {
        fileId: 'base/dep1.ts',
        imports: ['base/dep2.ts'],
      },
      {
        fileId: 'base/dep2.ts',
        imports: [],
      },
      ...cache,
    ])
  })
})
