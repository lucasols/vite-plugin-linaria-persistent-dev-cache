import { beforeEach, describe, expect, test } from 'vitest'
import { testOnly } from '../src/file-dep-hash'
import {
  getSortedCodeDepsCache,
  getSortedImports,
} from './utils/getSortedImports'
import { getFileDepHash } from './utils/setup'

const root = 'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/public/'

function getPublicFileDepHash(file: string) {
  return getFileDepHash(file, root)
}

function getSimplifiedSortedImports(imports: { fileId: string }[]) {
  return getSortedImports(imports, root + 'src/')
}

function getSimplifiedSortedCodeDepsCache() {
  return getSortedCodeDepsCache(root + 'src/')
}

beforeEach(() => {
  testOnly.resetCodeDepsCache()
})

describe('public tests', () => {
  test('simple case', () => {
    const result = getPublicFileDepHash('./src/base/base.tsx')

    expect(result.importsMap.length).toEqual(2)
    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "base/dep1.ts",
        "base/dep2.ts",
      ]
    `)
  })

  describe('caching after simple case', () => {
    test('simple case caching', () => {
      getPublicFileDepHash('./src/base/base.tsx')

      expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
        [
          {
            "fileId": "base/base.tsx",
            "imports": [
              "base/dep1.ts",
              "base/dep2.ts",
            ],
          },
          {
            "fileId": "base/dep1.ts",
            "imports": [
              "base/dep2.ts",
            ],
          },
          {
            "fileId": "base/dep2.ts",
            "imports": [],
          },
        ]
      `)
    })
  })

  describe('circular dependency is the main file', () => {
    test('deps are right', () => {
      const result = getPublicFileDepHash('./src/circular/circular.tsx')

      expect(result.importsMap.length).toEqual(2)
      expect(getSimplifiedSortedImports(result.importsMap))
        .toMatchInlineSnapshot(`
        [
          "circular/dep1.ts",
          "circular/dep2.ts",
        ]
      `)
    })

    test('simple circular dependency caching', () => {
      getPublicFileDepHash('./src/circular/circular.tsx')

      const result = getPublicFileDepHash('./src/circular/circular.tsx')

      expect(result.debug.cached).toEqual(1)
      expect(result.importsMap.length, 'num of deps').toEqual(2)
      expect(getSimplifiedSortedImports(result.importsMap))
        .toMatchInlineSnapshot(`
        [
          "circular/dep1.ts",
          "circular/dep2.ts",
        ]
      `)
    })

    test('cache format after circular dephash calc', () => {
      const result = getPublicFileDepHash('./src/circular/circular.tsx')

      expect(result.debug.getAllCodeDepsCalls).toEqual(3)
      expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
        [
          {
            "fileId": "circular/circular.tsx",
            "imports": [
              "circular/dep1.ts",
              "circular/dep2.ts",
            ],
          },
        ]
      `)
    })
  })

  describe('circular dependency that is not the main file', () => {
    test('deps are right', () => {
      const result = getPublicFileDepHash('./src/circular2/dep1.ts')

      expect(result.importsMap.length).toEqual(2)
      expect(getSimplifiedSortedImports(result.importsMap))
        .toMatchInlineSnapshot(`
        [
          "circular2/dep2.ts",
          "circular2/dep3.tsx",
        ]
      `)
    })

    test('cache format after circular dephash calc', () => {
      const result = getPublicFileDepHash('./src/circular2/dep1.ts')

      expect(result.debug.getAllCodeDepsCalls).toEqual(3)
      expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
        [
          {
            "fileId": "circular2/dep1.ts",
            "imports": [
              "circular2/dep2.ts",
              "circular2/dep3.tsx",
            ],
          },
        ]
      `)
    })
  })

  describe('multiple circular dependencies in one file', () => {
    test('cache format after circular dephash calc', () => {
      const result = getPublicFileDepHash('./src/circular3/dep1.ts')

      expect(result.importsMap.length).toEqual(4)
      expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
        [
          {
            "fileId": "circular3/dep1.ts",
            "imports": [
              "circular3/dep2.ts",
              "circular3/dep3.tsx",
              "circular3/dep4.ts",
              "circular3/dep5.ts",
            ],
          },
        ]
      `)
    })

    test.only('cache format after circular dephash calc 2', () => {
      const result = getPublicFileDepHash('./src/circular4/dep1.ts')

      expect(result.importsMap.length).toEqual(4)
      expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
        [
          {
            "fileId": "circular4/dep1.ts",
            "imports": [
              "circular4/dep2.ts",
              "circular4/dep3.tsx",
              "circular4/dep4.ts",
              "circular4/dep5.ts",
            ],
          },
        ]
      `)
    })
  })

  test('do not consider reimporting a file in child a circular dep', () => {
    const result = getPublicFileDepHash('./src/circular5/Dropdown.ts')

    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "circular5/Popover.ts",
        "circular5/PortalLayer.ts",
        "circular5/typings.ts",
        "circular5/useDelayValueUpdate.ts",
        "circular5/useOnClickOutiside.ts",
        "circular5/useTimeout.ts",
      ]
    `)

    expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
      [
        {
          "fileId": "circular5/Dropdown.ts",
          "imports": [
            "circular5/Popover.ts",
            "circular5/PortalLayer.ts",
            "circular5/typings.ts",
            "circular5/useDelayValueUpdate.ts",
            "circular5/useOnClickOutiside.ts",
            "circular5/useTimeout.ts",
          ],
        },
        {
          "fileId": "circular5/Popover.ts",
          "imports": [
            "circular5/PortalLayer.ts",
          ],
        },
        {
          "fileId": "circular5/PortalLayer.ts",
          "imports": [],
        },
        {
          "fileId": "circular5/typings.ts",
          "imports": [],
        },
        {
          "fileId": "circular5/useDelayValueUpdate.ts",
          "imports": [
            "circular5/useTimeout.ts",
          ],
        },
        {
          "fileId": "circular5/useOnClickOutiside.ts",
          "imports": [],
        },
        {
          "fileId": "circular5/useTimeout.ts",
          "imports": [
            "circular5/typings.ts",
          ],
        }
      ]
    `)
  })
})
