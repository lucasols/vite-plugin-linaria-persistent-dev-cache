import { describe, expect, test } from 'vitest'
import { testOnly } from '../src/file-dep-hash'
import { getPrivateFileDepHash } from './utils/setup'

describe('caches the deps of previous calls', () => {
  describe('Table then', () => {
    test('cache files', () => {
      const tableResult = getPrivateFileDepHash(
        './src/components/Table/Table.tsx',
      )

      console.log(tableResult.debug.timing)

      expect(tableResult.importsMap.length).toEqual(726)
      expect(tableResult.debug.addedToCache).toEqual(137)
    })

    test('Table second call', () => {
      const tableResult2 = getPrivateFileDepHash(
        './src/components/Table/Table.tsx',
      )

      expect(tableResult2.debug.cached).toEqual(1)
      expect(tableResult2.debug.notCached).toEqual(0)

      expect(tableResult2.importsMap.length, 'num of deps').toEqual(726)

      console.log(tableResult2.debug.timing)

      expect(tableResult2.debug.timing).toBeLessThan(20)
    })

    test('Dropdown', () => {
      const result = getPrivateFileDepHash(
        './src/components/Dropdown/Dropdown.tsx',
      )

      expect(result.importsMap.length).toEqual(6)

      expect(result.debug.getAllCodeDepsCalls).toEqual(7)
      expect(result.debug.cached).toEqual(3)
      expect(result.debug.notCached).toEqual(4)
      expect(result.debug.addedToCache).toEqual(2)
    })

    test('MoreMenu', () => {
      const result = getPrivateFileDepHash('./src/components/MoreMenu.tsx')

      expect(result.importsMap.length).toEqual(29)

      expect(result.debug.cached).toEqual(1)
      expect(result.debug.notCached).toEqual(0)
    })
  })

  test('MoreMenu then DropDown', () => {
    testOnly.resetCodeDepsCache()

    const moreMenuResult = getPrivateFileDepHash(
      './src/components/MoreMenu.tsx',
    )

    expect(moreMenuResult.importsMap.length).toEqual(29)
    expect(moreMenuResult.debug.cached).toEqual(0)

    const dropdownResult = getPrivateFileDepHash(
      './src/components/Dropdown/Dropdown.tsx',
    )

    expect(dropdownResult.importsMap.length).toEqual(6)
    expect(dropdownResult.debug.cached).toEqual(1)
    expect(dropdownResult.debug.notCached).toEqual(0)
  })
})
