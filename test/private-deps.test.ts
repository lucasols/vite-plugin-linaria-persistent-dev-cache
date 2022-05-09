import { beforeEach, describe, expect, test } from 'vitest'
import { testOnly } from '../src/file-dep-hash'
import { getSortedImports } from './utils/getSortedImports'
import { getFileDepHash } from './utils/setup'

const root = 'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/private'

function getPrivateFileDepHash(file: string, exclude?: RegExp[]) {
  return getFileDepHash(file, root, exclude)
}

beforeEach(() => {
  testOnly.resetCodeDepsCache()
})

describe('get the correct deps for a file', () => {
  let tableResult: ReturnType<typeof getPrivateFileDepHash>

  test('Table deps', () => {
    tableResult = getPrivateFileDepHash('./src/components/Table/Table.tsx')
    expect(tableResult.importsMap.length).toEqual(726)

    expect(getSortedImports(tableResult.importsMap)).toMatchSnapshot()
  })

  test('result import values are not equal', () => {
    const [a, b] = tableResult.importsMap

    expect(a === b).toBe(false)
  })

  test('Dropdown deps', () => {
    const result = getPrivateFileDepHash(
      './src/components/Dropdown/Dropdown.tsx',
    )

    expect(result.importsMap.length).toEqual(6)

    expect(getSortedImports(result.importsMap)).toMatchSnapshot()
  })

  test('MoreMenu deps', () => {
    const result = getPrivateFileDepHash('./src/components/MoreMenu.tsx')

    expect(result.importsMap.length).toEqual(29)

    expect(getSortedImports(result.importsMap)).toMatchSnapshot()
  })
})

describe('exclude patterns', () => {
  test('Table deps', () => {
    const tableResult = getPrivateFileDepHash(
      './src/components/Table/Table.tsx',
      [/^@src\/state\//, /^@src\/api\//, /^@src\/utils\//],
    )
    expect(tableResult.importsMap.length).toEqual(332)
  })
})
