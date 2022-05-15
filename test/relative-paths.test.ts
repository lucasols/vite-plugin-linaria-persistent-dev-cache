import fs from 'fs'
import path from 'path'
import { expect, test } from 'vitest'
import { createFileDepHash } from '../src/fileDepHash'
import {
  getSortedCodeDepsCache,
  getSortedImports,
} from './utils/getSortedImports'

const root = `${__dirname}/__mocks__/public/src/relative`

function getSimplifiedSortedImports(
  imports: { fileId: string }[],
  alternativeRoot = root,
) {
  return getSortedImports(imports, alternativeRoot)
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

  const relativeRoot = path.normalize(process.cwd())

  expect(result.importsMap.length).toEqual(2)
  expect(getSimplifiedSortedImports(result.importsMap, relativeRoot))
    .toMatchInlineSnapshot(`
    [
      "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script1.ts",
      "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
    ]
  `)
  expect(result.hash).toMatchInlineSnapshot(
    '"cb412c8ef8911ca8b9ec69794418dec56cd296dd||f3bf3a1375175076ebf01cfe363dfb2b31ed2a43"',
  )

  expect(getSortedCodeDepsCache(root, fileDepHash, relativeRoot)).toMatchInlineSnapshot(`
    [
      {
        "fileId": "/vite.config.ts",
        "imports": [
          "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script1.ts",
          "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
        ],
      },
      {
        "fileId": "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script1.ts",
        "imports": [
          "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
        ],
      },
      {
        "fileId": "\\\\test\\\\__mocks__\\\\public\\\\src\\\\relative\\\\scripts\\\\script2.ts",
        "imports": [],
      },
    ]
  `)
})
