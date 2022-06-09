import { beforeEach, describe, expect, test } from 'vitest'
import {
  getSortedCodeDepsCache,
  getSortedImports,
} from './utils/getSortedImports'
import { createFileDeepHashInstance, getFileDepHash } from './utils/setup'

const root = `${__dirname}/__mocks__/public/`

const fileDepHash = createFileDeepHashInstance(root)

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

  describe('circular 1: dependency is the main file', () => {
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
          {
            "fileId": "circular/dep1.ts",
            "imports": false,
          },
          {
            "fileId": "circular/dep2.ts",
            "imports": false,
          },
        ]
      `)
    })
  })

  describe('circular 2: dependency that is not the main file', () => {
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
          {
            "fileId": "circular2/dep2.ts",
            "imports": false,
          },
          {
            "fileId": "circular2/dep3.tsx",
            "imports": false,
          },
        ]
      `)
    })
  })

  describe('circular 3: multiple circular dependencies in one file', () => {
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
          {
            "fileId": "circular3/dep5.ts",
            "imports": false,
          },
        ]
      `)
    })
  })

  test('circular 4: multiple circular dependencies in one file', () => {
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
          {
            "fileId": "circular4/dep2.ts",
            "imports": false,
          },
          {
            "fileId": "circular4/dep3.tsx",
            "imports": false,
          },
          {
            "fileId": "circular4/dep4.ts",
            "imports": false,
          },
          {
            "fileId": "circular4/dep5.ts",
            "imports": false,
          },
        ]
      `)
  })

  test('simple 5: do not consider reimporting a file in child a circular dep', () => {
    const result = getPublicFileDepHash('./src/simple5/Dropdown.ts')

    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "simple5/Popover.ts",
        "simple5/PortalLayer.ts",
        "simple5/typings.ts",
        "simple5/useDelayValueUpdate.ts",
        "simple5/useOnClickOutiside.ts",
        "simple5/useTimeout.ts",
      ]
    `)

    expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
      [
        {
          "fileId": "simple5/Dropdown.ts",
          "imports": [
            "simple5/Popover.ts",
            "simple5/PortalLayer.ts",
            "simple5/typings.ts",
            "simple5/useDelayValueUpdate.ts",
            "simple5/useOnClickOutiside.ts",
            "simple5/useTimeout.ts",
          ],
        },
        {
          "fileId": "simple5/Popover.ts",
          "imports": [
            "simple5/PortalLayer.ts",
          ],
        },
        {
          "fileId": "simple5/PortalLayer.ts",
          "imports": [],
        },
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

  test('simple 6', () => {
    const result = getPublicFileDepHash('./src/simple6/dep1.ts')

    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "simple6/dep2.ts",
        "simple6/dep3.ts",
        "simple6/dep4.ts",
      ]
    `)

    expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
      [
        {
          "fileId": "simple6/dep1.ts",
          "imports": [
            "simple6/dep2.ts",
            "simple6/dep3.ts",
            "simple6/dep4.ts",
          ],
        },
        {
          "fileId": "simple6/dep2.ts",
          "imports": [
            "simple6/dep3.ts",
          ],
        },
        {
          "fileId": "simple6/dep3.ts",
          "imports": [],
        },
        {
          "fileId": "simple6/dep4.ts",
          "imports": [
            "simple6/dep2.ts",
            "simple6/dep3.ts",
          ],
        },
      ]
    `)
  })

  test('simple 7', () => {
    const result = getPublicFileDepHash('./src/simple7/dep1.ts')

    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "simple7/dep2.ts",
        "simple7/dep3.ts",
        "simple7/dep4.ts",
        "simple7/dep5.ts",
      ]
    `)

    expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
      [
        {
          "fileId": "simple7/dep1.ts",
          "imports": [
            "simple7/dep2.ts",
            "simple7/dep3.ts",
            "simple7/dep4.ts",
            "simple7/dep5.ts",
          ],
        },
        {
          "fileId": "simple7/dep2.ts",
          "imports": [
            "simple7/dep3.ts",
          ],
        },
        {
          "fileId": "simple7/dep3.ts",
          "imports": [],
        },
        {
          "fileId": "simple7/dep4.ts",
          "imports": [
            "simple7/dep5.ts",
          ],
        },
        {
          "fileId": "simple7/dep5.ts",
          "imports": [],
        },
      ]
    `)
  })

  test('circular 8', () => {
    const result = getPublicFileDepHash('./src/circular8/circular.ts')

    expect(getSimplifiedSortedImports(result.importsMap))
      .toMatchInlineSnapshot(`
      [
        "circular8/dep1.ts",
        "circular8/dep2.ts",
        "circular8/dep3.ts",
        "circular8/dep4.ts",
      ]
    `)

    expect(getSimplifiedSortedCodeDepsCache()).toMatchInlineSnapshot(`
      [
        {
          "fileId": "circular8/circular.ts",
          "imports": [
            "circular8/dep1.ts",
            "circular8/dep2.ts",
            "circular8/dep3.ts",
            "circular8/dep4.ts",
          ],
        },
        {
          "fileId": "circular8/dep1.ts",
          "imports": false,
        },
        {
          "fileId": "circular8/dep2.ts",
          "imports": false,
        },
        {
          "fileId": "circular8/dep3.ts",
          "imports": [
            "circular8/dep4.ts",
          ],
        },
        {
          "fileId": "circular8/dep4.ts",
          "imports": [],
        },
      ]
    `)
  })
})
