import { describe, expect, test } from 'vitest'
import {
  getSortedCodeDepsCache,
  getSortedImports,
} from './utils/getSortedImports'
import { createFileDeepHashInstance, getFileDepHash } from './utils/setup'

const root = 'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/private'

const fileDepHash = createFileDeepHashInstance(root)

function getSimplifiedSortedCodeDepsCache() {
  return getSortedCodeDepsCache(root + 'src/', fileDepHash)
}

function getSimplifiedSortedImports(imports: { fileId: string }[]) {
  return getSortedImports(imports, root)
}

function getPrivateFileDepHash(file: string) {
  return getFileDepHash(file, root, fileDepHash)
}

describe('caches the deps of previous calls', () => {
  describe('Table then', () => {
    test('cache files', () => {
      const tableResult = getPrivateFileDepHash(
        './src/components/Table/Table.tsx',
      )

      // +- 400
      console.log('first call', tableResult.debug.timing)

      expect(tableResult.importsMap.length).toEqual(726)
      expect(tableResult.debug.addedToCache).toEqual(317)
    })

    test('Table second call', () => {
      const tableResult2 = getPrivateFileDepHash(
        './src/components/Table/Table.tsx',
      )

      expect(tableResult2.debug.cached).toEqual(1)
      expect(tableResult2.debug.notCached).toEqual(0)

      expect(tableResult2.importsMap.length, 'num of deps').toEqual(726)

      console.log('second call', tableResult2.debug.timing)

      expect(tableResult2.debug.timing).toBeLessThan(30)
    })

    test('Dropdown', () => {
      const result = getPrivateFileDepHash(
        './src/components/Dropdown/Dropdown.tsx',
      )

      expect(result.importsMap.length).toEqual(6)

      expect(result.debug.getAllCodeDepsCalls).toEqual(1)
      expect(result.debug.cached).toEqual(1)
      expect(result.debug.notCached).toEqual(0)
      expect(result.debug.addedToCache).toEqual(0)
    })

    test('MoreMenu', () => {
      const result = getPrivateFileDepHash('./src/components/MoreMenu.tsx')

      expect(result.importsMap.length).toEqual(29)

      expect(result.debug.cached).toEqual(1)
      expect(result.debug.notCached).toEqual(0)
    })
  })

  test('uncached files', () => {
    const uncached = getSimplifiedSortedCodeDepsCache()
      .filter((entry) => !entry.imports)
      .map((entry) => entry.fileId.replace(root, ''))

    expect(uncached).toMatchSnapshot()
    expect(uncached.length).toMatchInlineSnapshot('410')
  })

  test('add file with circular dependency to cache', () => {
    const result = getPrivateFileDepHash('./src/components/Select/Select.tsx')

    expect(getSimplifiedSortedImports(result.importsMap)).toMatchSnapshot()

    const uncached = getSimplifiedSortedCodeDepsCache().filter(
      (entry) => !entry.imports,
    ).length

    expect(uncached).toEqual(409)
  })
})

test('MoreMenu then DropDown', () => {
  fileDepHash.resetCache()

  const moreMenuResult = getPrivateFileDepHash('./src/components/MoreMenu.tsx')

  expect(moreMenuResult.importsMap.length).toEqual(29)
  expect(moreMenuResult.debug.cached).toEqual(0)

  const dropdownResult = getPrivateFileDepHash(
    './src/components/Dropdown/Dropdown.tsx',
  )

  expect(dropdownResult.importsMap.length).toEqual(6)
  expect(dropdownResult.debug.cached).toEqual(1)
  expect(dropdownResult.debug.notCached).toEqual(0)
})
