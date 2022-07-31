import { describe, expect, test } from 'vitest'
import { testOnly } from '../lib/src/fileDepHash'
import fs from 'fs'
import path from 'path'

export function getImports(file: string) {
  const root = `${__dirname}/__mocks__/public/src/getImportsFromCode`
  const fileId = path.posix.join(root, file)

  const code = fs.readFileSync(fileId, 'utf-8')
  const include = [/^@src\//, /^@utils\//]

  const result = testOnly.getImportsFromCode(
    code,
    {
      include,
      exclude: [],
      aliases: [],
      rootDir: '.',
      resolveCache: new Map(),
      codeDepsCache: new Map(),
    },
    new Set(),
  )

  return result
}

test('ignore comments', () => {
  const imports = getImports('./ignore-comments.ts')

  expect(imports).toMatchInlineSnapshot(`
    [
      "@utils/checkIf",
      "@utils/hooks/useDragAndDrop",
      "@utils/hooks/useInfiniteLoading",
      "@utils/i18n/i18n",
      "@utils/typings",
      "@src/components/ButtonElement",
      "@src/components/PullToRefresh",
      "@src/components/Table/BodyCell",
      "@src/components/Table/EditCell",
      "@src/components/Table/HeaderCell",
    ]
  `)
})

describe('different line end types', () => {
  const semiImports = getImports('./with-semi.ts')

  test('with semi', () => {
    expect(semiImports).toMatchInlineSnapshot(`
      [
        "@utils/checkIf",
        "@utils/hooks/useDragAndDrop",
        "@utils/hooks/useInfiniteLoading",
        "@utils/i18n/i18n",
        "@utils/typings",
        "@src/components/ButtonElement",
        "@src/components/Checkbox",
        "@src/components/CircularProgress",
        "@src/components/Icon",
        "@src/components/PullToRefresh",
        "@src/components/SkeletonLoader",
        "@src/components/Table/BodyCell",
        "@src/components/Table/EditCell",
        "@src/components/Table/HeaderCell",
        "@src/components/Tooltip",
        "@src/state/objectDataCollection",
        "@src/state/objectFields/objectFieldsCollection",
        "@src/state/toastStore",
        "@src/style/mediaQueries",
        "@src/style/theme",
        "@src/style/helpers/allowTextSelection",
        "@src/style/helpers/centerContent",
        "@src/style/helpers/circle",
        "@src/style/helpers/fillContainer",
        "@src/style/helpers/inline",
        "@src/style/helpers/transition",
        "@src/api/schemas/responses/object.list",
        "@src/utils/isMobile",
        "@src/utils/modals",
        "@src/components/TextField/textMasks",
        "@utils/hooks/useAutoresize",
        "@utils/clamp",
        "@utils/reorderItemInArray",
        "@utils/toggleItemsInArray",
        "@utils/cx",
      ]
    `)
  })

  test('without semi', () => {
    const noSemiImports = getImports('./with-no-semi.ts')

    expect(noSemiImports).toStrictEqual(semiImports)
  })

  test('mixed', () => {
    const mixedImports = getImports('./with-semi-and-no-semi.ts')

    expect(mixedImports).toStrictEqual(semiImports)
  })

  test('ignore types', () => {
    const imports = getImports('./ignore-type-imports.ts')

    expect(imports).toMatchInlineSnapshot(`
      [
        "@utils/checkIf",
        "@utils/hooks/useDragAndDrop",
        "@utils/hooks/useInfiniteLoading",
        "@utils/i18n/i18n",
        "@utils/typings",
        "@src/components/ButtonElement",
        "@src/components/PullToRefresh",
        "@src/components/Table/EditCell",
        "@src/components/Table/HeaderCell2",
        "@src/components/Table/HeaderCell4",
        "@src/objectFieldsCollection",
        "@src/objectFieldsCollection2",
        "@src/objectFieldsCollection3",
      ]
    `)
  })
})
