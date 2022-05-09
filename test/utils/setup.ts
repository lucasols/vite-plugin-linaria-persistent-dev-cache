import fs from 'fs'
import path from 'path'
import { getCodeHash } from '../../src/file-dep-hash'

const defaultInclude = [/^@src\//, /^@utils\//]
const defaultAliases = [
  { find: '@src', replacement: '/src' },
  { find: '@utils', replacement: '/utils' },
]

export function getFileDepHash(
  file: string,
  root: string,
  exclude: RegExp[] = [],
) {
  const fileId = path.posix.join(root, file)

  const code = fs.readFileSync(fileId, 'utf-8')

  const result = getCodeHash(
    fileId,
    code,
    defaultInclude,
    exclude,
    defaultAliases,
    root,
  )

  return result
}
