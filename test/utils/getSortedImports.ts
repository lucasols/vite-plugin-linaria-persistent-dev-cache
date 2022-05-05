import { getCodeDepsCache } from "../../src/file-dep-hash";
import { sortBy } from "./sortBy";

export function getSortedImports(
  imports: { fileId: string }[],
  replaceRoot?: string
) {
  return imports
    .map((item) =>
      replaceRoot ? item.fileId.replace(replaceRoot, "") : item.fileId
    )
    .sort();
}

export function getSortedCodeDepsCache(root: string) {
  const codeDepsCache = getCodeDepsCache();

  const deps: { fileId: string; imports: string[] }[] = [];

  for (const [fileId, cacheEntry] of codeDepsCache.entries()) {
    deps.push({
      fileId: fileId.replace(root, ""),
      imports: sortBy(
        [...cacheEntry.depsId.values()].map((item) => item.replace(root, "")),
        (dep) => dep
      ),
    });
  }

  return sortBy(deps, (dep) => dep.fileId);
}
