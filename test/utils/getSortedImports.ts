import { getResolvedCache } from '../../src/deepFirstSearch'
import { testOnly } from '../../src/file-dep-hash'
import { sortBy } from './sortBy'

export function getSortedImports(
  imports: { fileId: string }[],
  replaceRoot?: string,
) {
  return imports
    .map((item) =>
      replaceRoot ? item.fileId.replace(replaceRoot, '') : item.fileId,
    )
    .sort()
}

export function getSortedCodeDepsCache(root: string) {
  const codeDepsCache = testOnly.getCodeDepsCache()

  const deps: { fileId: string; imports: string[] }[] = []

  for (const [fileId, cacheEntry] of codeDepsCache.entries()) {
    deps.push({
      fileId: fileId.replace(root, ''),
      imports: sortBy(
        [...cacheEntry.depsId.values()].map((item) => item.replace(root, '')),
        (dep) => dep,
      ),
    })
  }

  return sortBy(deps, (dep) => dep.fileId)
}

type FileEntry = { fileId: string; imports: string[] | false }

export function getDFSStableCache(): FileEntry[] {
  const files: FileEntry[] = []

  const cache = getResolvedCache()

  for (const [fileId, deps] of cache) {
    files.push({
      fileId,
      imports: deps && sortBy([...deps], (i) => i),
    })
  }

  return sortBy(files, (f) => f.fileId)
}
