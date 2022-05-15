import fs from 'fs'
import path from 'path'
import { createFileDepHash, FileDepHashInstance } from '../../src/fileDepHash'

const defaultInclude = [/^@src\//, /^@utils\//]
const defaultAliases = [
  { find: '@src', replacement: '/src' },
  { find: '@utils', replacement: '/utils' },
]

export function createFileDeepHashInstance(
  rootDir: string,
  exclude: RegExp[] = [],
) {
  return createFileDepHash({
    rootDir: rootDir,
    aliases: defaultAliases,
    include: defaultInclude,
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
