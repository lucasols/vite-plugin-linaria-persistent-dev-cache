import { getResolvedCache } from '../dfs/deepFirstSearch'
import { FileDepHashInstance, testOnly } from '../../lib/src/fileDepHash'
import { sortBy } from '../../lib/src/utils'

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

function replaceRoot(path: string, root: string, root2: string) {
  const firstReplace = path.replace(root, '')

  if (firstReplace !== path) {
    return firstReplace
  }

  return path.replace(root2, '')
}

export function getSortedCodeDepsCache(
  root: string,
  deepHashInstance: FileDepHashInstance,
  relativeRoot: string = '',
) {
  const codeDepsCache = deepHashInstance.getCodeDepsCache()

  const deps: { fileId: string; imports: string[] | false }[] = []

  for (const [fileId, cacheEntry] of codeDepsCache.entries()) {
    deps.push({
      fileId: replaceRoot(fileId, root, relativeRoot),
      imports:
        cacheEntry &&
        sortBy(
          [...cacheEntry.depsId.values()].map((item) =>
            item.replace(relativeRoot || root, ''),
          ),
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
