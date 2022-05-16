import fs from 'fs'
import path from 'path'
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
): string[] {
  const codeWithoutComments = code.replace(/\/\/.*|\/\*[^]*?\*\//g, '')

  const regex = /from\s+['"]([^'"]+)['"]/g

  const allPossibleImports = codeWithoutComments.matchAll(regex)

  const imports: string[] = []

  for (const [_, path] of allPossibleImports) {
    if (!include.some((pattern) => pattern.test(path!))) {
      continue
    }

    if (exclude.some((regex) => regex.test(path!))) {
      continue
    }

    imports.push(path!)
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
      if (
        typeof find === 'string'
          ? normalizedPath.startsWith(find)
          : find.test(normalizedPath)
      ) {
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

    if (fs.statSync(testURL, { throwIfNoEntry: false })) {
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
  notCached: number
  addedToCache: number
  timing: number
  getAllCodeDepsCalls: number
}

function getEdges(
  code: string,
  parentFileId: string,
  config: InstanceProps,
): string[] {
  const imports = getImportsFromCode(code, config)

  const edges: string[] = []

  for (const importPath of imports) {
    const resolvedFiledId = getResolvedPath(importPath, config, parentFileId)

    if (!resolvedFiledId) {
      continue
    }

    edges.push(resolvedFiledId)
  }

  return edges
}

function mergeEdgeDeps(
  edge: string,
  deps: Map<string, string>,
  config: InstanceProps,
) {
  const cacheEntry = config.codeDepsCache.get(edge)

  if (!cacheEntry) {
    return
  }

  const edgeDeps = cacheEntry.deps

  for (const dep of edgeDeps) {
    deps.set(dep.fileId, dep.code)
  }
}

function getAllCodeDeps(
  fileId: string,
  code: string,
  config: InstanceProps,
  debug: Debug,
  visited: Map<string, string> = new Map(),
  inPath: Set<string> = new Set(),
  deepth = 0,
): { deps: CodeDependency[]; hasCircularDep: boolean } {
  debug.getAllCodeDepsCalls++

  const cachedValue = config.codeDepsCache.get(fileId)

  if (cachedValue) {
    debug.cached++

    return { deps: cachedValue.deps, hasCircularDep: false }
  }

  visited.set(fileId, code)
  inPath.add(fileId)

  const edges = getEdges(code, fileId, config)

  const deps = new Map<string, string>()

  let hasCircularDep = false

  for (const edge of edges) {
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

    mergeEdgeDeps(edge, deps, config)
  }

  inPath.delete(fileId)

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
      debug.notCached
      config.codeDepsCache.set(fileId, false)
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
) {
  for (const [depFileId, code] of deps) {
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
): CodeHashResult {
  const debug: Debug = {
    cached: 0,
    notCached: 0,
    addedToCache: 0,
    timing: 0,
    getAllCodeDepsCalls: 0,
  }

  const start = Date.now()

  const importsMap = getAllCodeDeps(fileId, code, config, debug)

  const codeHash = generateStringHash(code)

  let importsHash = ''

  for (const { code, fileId } of importsMap.deps) {
    importsHash += generateStringHash(`${fileId}||${code}`)
  }

  debug.timing = Date.now() - start

  return {
    hash: `${codeHash}||${generateStringHash(importsHash)}`,
    importsMap: importsMap.deps,
    debug,
  }
}

export type FileDepHashInstance = {
  resetCache: () => void
  getHash: (fileId: string, code: string) => CodeHashResult
  getCodeDepsCache: () => Map<string, CacheEntry>
  cleanCacheForFile: (fileId: string) => void
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

  function resetCache() {
    codeDepsCache.clear()
    changedAfterInitialBuild.clear()
  }

  function getCodeDepsCache() {
    return codeDepsCache
  }

  function cleanCacheForFile(fileId: string) {
    cleanCodeDepsCacheForFile(fileId, instance)
  }

  function getHash(fileId: string, code: string): CodeHashResult {
    return getCodeHash(fileId, code, instance)
  }

  return {
    resetCache,
    getHash,
    getCodeDepsCache,
    cleanCacheForFile,
  }
}

export const testOnly = {
  getImportsFromCode,
}
