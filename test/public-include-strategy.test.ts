import { beforeEach, describe, expect, test } from 'vitest'
import {
  getSortedCodeDepsCache,
  getSortedImports,
} from './utils/getSortedImports'
import { createFileDeepHashInstance, getFileDepHash } from './utils/setup'

const root = `${__dirname}/__mocks__/public/`

const fileDepHash = createFileDeepHashInstance(root, [], undefined, [
  /^@src\/simple5\/useDelayValueUpdate/,
])

function getSimplifiedSortedCodeDepsCache() {
  return getSortedCodeDepsCache(root + 'src/', fileDepHash)
}

function getSimplifiedSortedImports(imports: { fileId: string }[]) {
  return getSortedImports(imports, root + 'src/')
}

function getPublicFileDepHash(file: string) {
  return getFileDepHash(file, root, fileDepHash)
}

beforeEach(() => {
  fileDepHash.resetCache()
  fileDepHash._resetDebug()
})

describe('public tests', () => {
  test('includes child imports', () => {
    const result = getPublicFileDepHash('./src/simple5/Dropdown.ts')

    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "simple5/typings.ts",
        "simple5/useDelayValueUpdate.ts",
        "simple5/useTimeout.ts",
      ]
    `)

    const expectedCache = [
      {
        fileId: 'simple5/Dropdown.ts',
        imports: [
          'simple5/typings.ts',
          'simple5/useDelayValueUpdate.ts',
          'simple5/useTimeout.ts',
        ],
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
        fileId: 'simple5/useTimeout.ts',
        imports: ['simple5/typings.ts'],
      },
    ]

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual(expectedCache)

    const result2 = getPublicFileDepHash('./src/simple5/useDelayValueUpdate.ts')

    expect(
      getSimplifiedSortedImports(result2.importsMap),
    ).toMatchInlineSnapshot(`
      [
        "simple5/typings.ts",
        "simple5/useTimeout.ts",
      ]
    `)

    expect(getSimplifiedSortedCodeDepsCache()).toStrictEqual(expectedCache)
  })
})
