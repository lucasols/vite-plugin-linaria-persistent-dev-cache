import fs from 'fs'
import path from 'path'
import { createFileDepHash, FileDepHashInstance } from '../../src/fileDepHash'

const defaultInclude = [/^@src\//, /^@utils\//]
const defaultAliases: [find: string, replacement: string][] = [
  ['@src', '/src'],
  ['@utils', '/utils'],
]

export function createFileDeepHashInstance(
  rootDir: string,
  exclude: RegExp[] = [],
  aliases = defaultAliases,
  include: RegExp[] = defaultInclude,
) {
  return createFileDepHash({
    rootDir: rootDir,
    aliases,
    include,
    exclude,
  })
}

export function getFileDepHash(
  file: string,
  root: string,
  deepHashInstance: FileDepHashInstance,
) {
  const fileId = path.posix.join(root, file)

  const code = fs.readFileSync(fileId, 'utf-8')

  const result = deepHashInstance.getHash(fileId, code)

  return result
}
