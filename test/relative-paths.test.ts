import fs from 'fs'
import { expect, test } from 'vitest'
import { getCodeHash, testOnly } from '../src/file-dep-hash'
import { getSortedCodeDepsCache } from './utils/getSortedImports'

const root =
  'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/public/src/relative'

function getFileDepHash() {
  const fileId = root + '/vite.config.ts'

  const code = fs.readFileSync(fileId, 'utf8')

  return getCodeHash(fileId, code, {
    rootDir: root,
    aliases: [],
    resolveRelative: true,
    include: [/^\.+/],
    exclude: [],
    disableDepCache: true,
  })
}

test('resolve relative imports', () => {
  const result = getFileDepHash()

  expect(result.debug.addedToCache).toBe(0)
  expect(result.importsMap.length).toEqual(2)
  expect(result.importsMap).toMatchInlineSnapshot('[]')
  expect(result.hash).toMatchInlineSnapshot('"f6a69a95987b9bb6d7f90625a3af5e834f1ea5bb||da39a3ee5e6b4b0d3255bfef95601890afd80709"')

  expect(getSortedCodeDepsCache(root)).toMatchInlineSnapshot('[]')
})
