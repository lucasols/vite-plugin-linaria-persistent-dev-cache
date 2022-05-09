import path from 'path'
import { beforeEach, expect, test } from 'vitest'
import { cleanCodeDepsCacheForFile, testOnly } from '../src/file-dep-hash'
import { getSortedCodeDepsCache } from './utils/getSortedImports'
import { getFileDepHash } from './utils/setup'

const root = 'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/public/'

function getPublicFileDepHash(file: string) {
  return getFileDepHash(file, root)
}

export function getFileId(file: string) {
  return path.posix.join(root, file)
}

function getSimplifiedSortedCodeDepsCache() {
  return getSortedCodeDepsCache(root + 'src/')
}

beforeEach(() => {
  testOnly.resetCodeDepsCache()
})

test('invalidates cache of file', () => {
  const result = getPublicFileDepHash('./src/simple5/Dropdown.ts')

  expect(result.importsMap.length).toEqual(6)

  cleanCodeDepsCacheForFile(getFileId('./src/simple5/PortalLayer.ts'))

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
  const result = getPublicFileDepHash('./src/circular3/dep1.ts')

  expect(result.importsMap.length).toEqual(4)

  cleanCodeDepsCacheForFile(getFileId('./src/circular3/dep5.ts'))

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
