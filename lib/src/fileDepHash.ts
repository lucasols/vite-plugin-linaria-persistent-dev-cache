import fs from 'fs'
import path from 'path'
import { sortBy } from './utils'
import { generateStringHash } from './utils'

type Aliases = {
  find: string | RegExp
  replacement: string
}[]

interface FileDepHashConfig {
  include: RegExp[]
  exclude: RegExp[]
  aliases: Aliases
  rootDir: string
  resolveRelative?: boolean
}

interface InstanceProps extends FileDepHashConfig {
  resolveCache: Map<string, string>
  codeDepsCache: Map<string, CacheEntry>
}

function getImportsFromCode(
  code: string,
  { include, exclude }: InstanceProps,
  inPathImportPaths: Set<string>,
): string[] {
  const codeWithoutComments = code.replace(/\/\/.*|\/\*[^]*?\*\//g, '')

  const regex =
    /import (?!type {|{(?: type \w+,*)+ }|{\n(?: *type *\w+,*\n)+})[\s\S]+?from\s+['"]([^'"]+)['"]/g

  const allPossibleImports = codeWithoutComments.matchAll(regex)

  const imports: string[] = []

  let isInAIncludedBranch = inPathImportPaths.size >= 2

  if (!isInAIncludedBranch) {
    const firstImport = [...inPathImportPaths.values()][0]

    if (firstImport) {
      isInAIncludedBranch = include.some((regex) => regex.test(firstImport))
    }
  }

  for (const [_, importPath] of allPossibleImports) {
    if (importPath!.endsWith('.json')) {
      continue
    }

    const includeFile =
      isInAIncludedBranch || include.some((regex) => regex.test(importPath!))

    if (!includeFile) {
      continue
    }

    if (exclude.some((regex) => regex.test(importPath!))) {
      continue
    }

    imports.push(importPath!)
  }

  return imports
}

function getResolvedPath(
  filePath: string,
  { aliases, rootDir, resolveCache, resolveRelative }: InstanceProps,
  resolveRelativeFrom: string,
): string | false {
  if (!resolveRelative && resolveCache.has(filePath)) {
    return resolveCache.get(filePath)!
  }

  let normalizedPath = filePath

  if (resolveRelative) {
    normalizedPath = path.resolve(path.dirname(resolveRelativeFrom), filePath)
  } else {
    for (const { find, replacement } of aliases) {
      if (typeof find !== 'string') {
        continue
      }

      if (normalizedPath.startsWith(find)) {
        normalizedPath = normalizedPath.replace(find, replacement)
      }
    }

    normalizedPath = path.posix.join(rootDir, normalizedPath)
  }

  const fileName = path.basename(normalizedPath)

  const firstLetterIsUpper = fileName[0]?.toUpperCase() === fileName[0]

  const testSuffix = firstLetterIsUpper
    ? ['.tsx', '.ts', '/index.tsx', '/index.ts']
    : ['.ts', '.tsx', '/index.ts', '/index.tsx']

  for (const suffix of testSuffix) {
    const testURL = `${normalizedPath}${suffix}`

    if (fs.statSync(testURL, { throwIfNoEntry: false })?.isFile()) {
      return testURL
    }
  }

  return false
}

function getCodeFromResolvedPath(
  resolvedPath: string,
  config: InstanceProps,
  resolveRelativeFrom: string,
): string {
  let code: string

  try {
    code = fs.readFileSync(resolvedPath, 'utf8')
  } catch (e) {
    for (const [unresolved, resolved] of config.resolveCache) {
      if (resolved === resolvedPath) {
        config.resolveCache.delete(unresolved)

        const resolvedPath = getResolvedPath(
          unresolved,
          config,
          resolveRelativeFrom,
        )

        if (!resolvedPath) {
          console.error(`Could not resolve ${unresolved}`)
        }

        if (resolvedPath) {
          return getCodeFromResolvedPath(
            resolvedPath,
            config,
            resolveRelativeFrom,
          )
        }
      }
    }

    throw e
  }

  return code
}

type CodeDependency = {
  fileId: string
  code: string
}

type CacheEntry =
  | {
      deps: CodeDependency[]
      depsId: Set<string>
    }
  | false

type Debug = {
  cached: number
  addedToCache: number
  timing: number
  getAllCodeDepsCalls: number
}

type Edge = {
  fileId: string
  importPath: string
}

function getEdges(
  code: string,
  parentFileId: string,
  config: InstanceProps,
  inPathImportPaths: Set<string>,
): Edge[] {
  const imports = getImportsFromCode(code, config, inPathImportPaths)

  const edges: Edge[] = []

  for (const importPath of imports) {
    const fileId = getResolvedPath(importPath, config, parentFileId)

    if (!fileId) {
      continue
    }

    edges.push({ fileId, importPath })
  }

  return edges
}

function mergeEdgeDeps(
  edge: string,
  deps: Map<string, string>,
  config: InstanceProps,
  visited: Map<string, string>,
) {
  const cacheEntry = config.codeDepsCache.get(edge)

  if (!cacheEntry) {
    return
  }

  const edgeDeps = cacheEntry.deps

  for (const dep of edgeDeps) {
    deps.set(dep.fileId, dep.code)
    visited.set(dep.fileId, dep.code)
  }
}

function getImportPathFromFileId(
  fileId: string,
  config: InstanceProps,
): string | false {
  const relativePath = fileId.replace(config.rootDir, '/')

  for (const alias of config.aliases) {
    if (typeof alias.find !== 'string') {
      continue
    }

    if (relativePath.startsWith(alias.replacement)) {
      return relativePath.replace(alias.replacement, alias.find)
    }
  }
  return false
}

function getAllCodeDeps(
  fileId: string,
  code: string,
  config: InstanceProps,
  debug: Debug,
  visited: Map<string, string> = new Map(),
  inPath: Set<string> = new Set(),
  inPathImportPaths: Set<string> = new Set(),
  _importPath: string | null = null,
  deepth = 0,
): { deps: CodeDependency[]; hasCircularDep: boolean } {
  debug.getAllCodeDepsCalls++

  const cachedValue = config.codeDepsCache.get(fileId)

  visited.set(fileId, code)

  if (cachedValue) {
    debug.cached++

    return { deps: cachedValue.deps, hasCircularDep: false }
  }

  let importPath = _importPath || getImportPathFromFileId(fileId, config)

  inPath.add(fileId)
  if (importPath) inPathImportPaths.add(importPath)

  const edges = getEdges(code, fileId, config, inPathImportPaths)

  const deps = new Map<string, string>()

  let hasCircularDep = false

  for (const { fileId: edge, importPath } of edges) {
    if (inPath.has(edge)) {
      hasCircularDep = true
      continue
    }

    let edgeHasCircularDep = false

    let edgeCode: string

    if (!visited.has(edge)) {
      edgeCode = getCodeFromResolvedPath(edge, config, fileId)

      edgeHasCircularDep = getAllCodeDeps(
        edge,
        edgeCode,
        config,
        debug,
        visited,
        inPath,
        inPathImportPaths,
        importPath,
        deepth + 1,
      ).hasCircularDep
    } else {
      edgeHasCircularDep = !config.codeDepsCache.get(edge)

      edgeCode = visited.get(edge)!
    }

    if (edgeHasCircularDep) {
      hasCircularDep = true

      continue
    }

    deps.set(edge, edgeCode)

    mergeEdgeDeps(edge, deps, config, visited)
  }

  inPath.delete(fileId)
  if (importPath) inPathImportPaths.delete(importPath)

  if (deepth === 0) {
    visited.delete(fileId)
  }

  const depsArray: CodeDependency[] = []
  const depsId = new Set<string>()

  if (hasCircularDep) {
    if (deepth === 0) {
      populateDepsArray(visited, depsArray, depsId)

      debug.addedToCache++
      config.codeDepsCache.set(fileId, {
        deps: depsArray,
        depsId,
      })
    }
    //
    else {
      if (!config.codeDepsCache.has(fileId)) {
        config.codeDepsCache.set(fileId, false)
      }
    }
  }
  //
  else {
    populateDepsArray(deps, depsArray, depsId)

    debug.addedToCache++
    config.codeDepsCache.set(fileId, {
      deps: depsArray,
      depsId,
    })
  }

  return { deps: depsArray, hasCircularDep }
}

function populateDepsArray(
  deps: Map<string, string>,
  depsArray: CodeDependency[],
  depsId: Set<string>,
  extraDeps?: Map<string, string>,
) {
  for (const [depFileId, code] of deps) {
    addDep(depFileId, code)
  }

  if (extraDeps) {
    for (const [depFileId, code] of extraDeps) {
      if (!deps.has(depFileId)) {
        addDep(depFileId, code)
      }
    }
  }

  function addDep(depFileId: string, code: string) {
    depsArray.push({
      fileId: depFileId,
      code: code,
    })

    depsId.add(depFileId)
  }
}

function cleanCodeDepsCacheForFile(
  fileId: string,
  { codeDepsCache }: InstanceProps,
) {
  for (const [id, cacheEntry] of codeDepsCache.entries()) {
    if (fileId === id) {
      codeDepsCache.delete(id)
      continue
    }

    if (cacheEntry && cacheEntry.depsId.has(fileId)) {
      codeDepsCache.delete(id)
    }
  }
}

type CodeHashResult = {
  hash: string
  importsMap: CodeDependency[]
  debug: Debug
}

function getCodeHash(
  fileId: string,
  code: string,
  config: InstanceProps,
  debug: Debug,
): CodeHashResult {
  const start = Date.now()

  const importsMap = getAllCodeDeps(fileId, code, config, debug)

  const codeHash = generateStringHash(code)

  const sortedImports = sortBy(importsMap.deps, (item) => item.fileId)

  let importsHash = ''

  for (const { code, fileId } of sortedImports) {
    importsHash += generateStringHash(`${fileId}||${code}`)
  }

  debug.timing = Date.now() - start

  return {
    hash: `${codeHash}||${importsHash && generateStringHash(importsHash)}`,
    importsMap: importsMap.deps,
    debug,
  }
}

export type FileDepHashInstance = {
  resetCache: () => void
  getHash: (fileId: string, code: string) => CodeHashResult
  getCodeDepsCache: () => Map<string, CacheEntry>
  cleanCacheForFile: (fileId: string) => void
  getStats: () => Debug & { unoptimizedFiles: string[] }
  _resetDebug: () => void
}

export function createFileDepHash(
  config: FileDepHashConfig,
): FileDepHashInstance {
  const resolveCache = new Map<string, string>()
  const codeDepsCache = new Map<string, CacheEntry>()
  const changedAfterInitialBuild = new Set<string>()

  const instance: InstanceProps = {
    ...config,
    resolveCache,
    codeDepsCache,
  }

  const debug: Debug = {
    cached: 0,
    addedToCache: 0,
    timing: 0,
    getAllCodeDepsCalls: 0,
  }

  function resetCache() {
    codeDepsCache.clear()
    changedAfterInitialBuild.clear()
  }

  function getCodeDepsCache() {
    return codeDepsCache
  }

  function getStats() {
    return {
      unoptimizedFiles: [...codeDepsCache]
        .filter(([id, cacheEntry]) => !cacheEntry)
        .map(([id]) => id),
      ...debug,
    }
  }

  function cleanCacheForFile(fileId: string) {
    cleanCodeDepsCacheForFile(fileId, instance)
  }

  function getHash(fileId: string, code: string): CodeHashResult {
    return getCodeHash(fileId, code, instance, debug)
  }

  function _resetDebug() {
    debug.cached = 0
    debug.addedToCache = 0
    debug.timing = 0
    debug.getAllCodeDepsCalls = 0
  }

  return {
    resetCache,
    getHash,
    getCodeDepsCache,
    cleanCacheForFile,
    getStats,
    _resetDebug,
  }
}

export const testOnly = {
  getImportsFromCode,
}
