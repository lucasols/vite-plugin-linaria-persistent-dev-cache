import fs from 'fs'
import { expect, test } from 'vitest'
import { createFileDepHash } from '../src/file-dep-hash'
import {
  getSortedCodeDepsCache,
  getSortedImports,
} from './utils/getSortedImports'

const root =
  'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/public/src/relative'

function getSimplifiedSortedImports(imports: { fileId: string }[]) {
  return getSortedImports(imports, '')
}

const fileDepHash = createFileDepHash({
  rootDir: root,
  aliases: [],
  resolveRelative: true,
  include: [/^\.+/],
  exclude: [],
})

function getFileDepHash() {
  const fileId = root + '/vite.config.ts'

  const code = fs.readFileSync(fileId, 'utf8')

  return fileDepHash.getHash(fileId, code)
}

test('resolve relative imports', () => {
  const result = getFileDepHash()

  expect(result.importsMap.length).toEqual(2)
  expect(getSimplifiedSortedImports(result.importsMap)).toMatchInlineSnapshot(`
    [
      "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script1.ts",
      "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
    ]
  `)
  expect(result.hash).toMatchInlineSnapshot(
    '"cb412c8ef8911ca8b9ec69794418dec56cd296dd||59a96030a7fdc0772c57d6b7a42971b552760f8c"',
  )

  expect(getSortedCodeDepsCache(root, fileDepHash)).toMatchInlineSnapshot(`
    [
      {
        "fileId": "/vite.config.ts",
        "imports": [
          "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script1.ts",
          "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
        ],
      },
      {
        "fileId": "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script1.ts",
        "imports": [
          "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
        ],
      },
      {
        "fileId": "C:\\\\Users\\\\lucas\\\\Github\\\\file-dep-hash\\\\test\\\\___mocks___\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
        "imports": [],
      },
    ]
  `)
})
