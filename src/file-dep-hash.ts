import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function generateStringHash(str: string) {
  return crypto.createHash('sha1').update(str).digest('hex')
}

type Aliases = {
  find: string
  replacement: string
}[]

function getImportsFromCode(code: string, include: RegExp[]) {
  const codeWithoutComments = code.replace(/\/\/.*|\/\*[^]*?\*\//g, '')

  const regex = /from\s+['"]([^'"]+)['"]/g

  const allPossibleImports = codeWithoutComments.matchAll(regex)

  const imports: string[] = []

  for (const [_, path] of allPossibleImports) {
    if (include.some((pattern) => pattern.test(path!))) {
      imports.push(path!)
    }
  }

  return imports
}

const resolveCache = new Map<string, string>()

function getResolvedPath(
  filePath: string,
  aliases: Aliases,
  rootDir: string,
): string | false {
  if (resolveCache.has(filePath)) {
    return resolveCache.get(filePath)!
  }

  let normalizedPath = filePath

  for (const { find, replacement } of aliases) {
    if (normalizedPath.startsWith(find)) {
      normalizedPath = normalizedPath.replace(find, replacement)
    }
  }

  normalizedPath = path.posix.join(rootDir, normalizedPath)

  // FIX: change order based on file name casing, ex: ReactComp -> .tsx

  const testSuffix = ['.tsx', '.ts', '/index.tsx', '/index.ts']

  for (const suffix of testSuffix) {
    const testURL = `${normalizedPath}${suffix}`

    if (fs.statSync(testURL, { throwIfNoEntry: false })) {
      return testURL
    }
  }

  return false
}

type CodeDependency = {
  fileId: string
  code: string
}

const codeDepsCache = new Map<
  string,
  { deps: CodeDependency[]; depsId: Set<string> } | false
>()
const codeDepsCacheFilesIds = new Set<string>()

function getCodeDepsCache() {
  return codeDepsCache
}

type Debug = {
  cached: number
  notCached: number
  addedToCache: number
  timing: number
  getAllCodeDepsCalls: number
}

function getEdges(
  code: string,
  include: RegExp[],
  aliases: Aliases,
  rootDir: string,
): string[] {
  const imports = getImportsFromCode(code, include)

  const edges: string[] = []

  for (const importPath of imports) {
    const resolvedFiledId = getResolvedPath(importPath, aliases, rootDir)

    if (!resolvedFiledId) {
      continue
    }

    edges.push(resolvedFiledId)
  }

  return edges
}

function mergeEdgeDeps(
  edge: string,
  deps: Set<string>,
  codeCache: Map<string, string>,
) {
  const cacheEntry = codeDepsCache.get(edge)

  if (!cacheEntry) {
    return
  }

  const edgeDeps = cacheEntry.deps

  for (const dep of edgeDeps) {
    deps.add(dep.fileId)
    codeCache.set(dep.fileId, dep.code)
  }
}

function getAllCodeDeps(
  fileId: string,
  code: string,
  include: RegExp[],
  rootDir: string,
  aliases: Aliases,
  debug: Debug,
  visited: Set<string> = new Set(),
  inPath: Set<string> = new Set(),
  codeCache: Map<string, string> = new Map(),
  deepth = 0,
): { deps: CodeDependency[]; hasCircularDep: boolean } {
  debug.getAllCodeDepsCalls++

  const cachedValue = codeDepsCache.get(fileId)

  if (cachedValue) {
    debug.cached++
    return { deps: cachedValue.deps, hasCircularDep: false }
  }

  visited.add(fileId)
  codeCache.set(fileId, code)
  inPath.add(fileId)

  const edges = getEdges(code, include, aliases, rootDir)

  const deps = new Set<string>()

  let hasCircularDep = false

  for (const edge of edges) {
    if (inPath.has(edge)) {
      hasCircularDep = true
      continue
    }

    let edgeHasCircularDep = false

    if (!visited.has(edge)) {
      const edgeCode = fs.readFileSync(edge, 'utf8')

      edgeHasCircularDep = getAllCodeDeps(
        edge,
        edgeCode,
        include,
        rootDir,
        aliases,
        debug,
        visited,
        inPath,
        codeCache,
        deepth + 1,
      ).hasCircularDep
    } else {
      edgeHasCircularDep = !codeDepsCache.get(edge)
    }

    if (edgeHasCircularDep) {
      hasCircularDep = true
      continue
    }

    deps.add(edge)

    mergeEdgeDeps(edge, deps, codeCache)
  }

  inPath.delete(fileId)

  if (deepth === 0) {
    visited.delete(fileId)
  }

  const depsArray: CodeDependency[] = []

  if (hasCircularDep) {
    if (deepth === 0) {
      populateDepsArray(visited, codeCache, depsArray)

      debug.addedToCache++
      codeDepsCache.set(fileId, {
        deps: depsArray,
        depsId: visited,
      })
    }
    //
    else {
      debug.notCached
      codeDepsCache.set(fileId, false)
    }
  }
  //
  else {
    populateDepsArray(deps, codeCache, depsArray)

    debug.addedToCache++
    codeDepsCache.set(fileId, {
      deps: depsArray,
      depsId: deps,
    })
  }

  return { deps: depsArray, hasCircularDep }
}

function populateDepsArray(
  deps: Set<string>,
  codeCache: Map<string, string>,
  depsArray: CodeDependency[],
) {
  for (const depFileId of deps) {
    const code = codeCache.get(depFileId)

    if (!code) {
      throw new Error(`File ${depFileId} not found`)
    }

    depsArray.push({
      fileId: depFileId,
      code: code,
    })
  }
}

function cleanCodeDepsCacheForFile(fileId: string) {
  if (!codeDepsCacheFilesIds.has(fileId)) {
    // TODO: ignore files in the first build
    return
  }

  for (const [id, cacheEntry] of codeDepsCache.entries()) {
    if (fileId === id) {
      codeDepsCache.delete(id)
      continue
    }

    if (cacheEntry.depsId.has(fileId)) {
      codeDepsCache.delete(id)
    }
  }
}

export function getCodeHash(
  fileId: string,
  code: string,
  include: RegExp[],
  aliases: Aliases,
  rootDir: string,
): {
  hash: string
  importsMap: CodeDependency[]
  debug: Debug
} {
  // FIX: make debug optional
  const debug: Debug = {
    cached: 0,
    notCached: 0,
    addedToCache: 0,
    timing: 0,
    getAllCodeDepsCalls: 0,
  }

  const start = Date.now()

  const importsMap = getAllCodeDeps(
    fileId,
    code,
    include,
    rootDir,
    aliases,
    debug,
  )

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

function resetCodeDepsCache() {
  codeDepsCache.clear()
  codeDepsCacheFilesIds.clear()
}

export const testOnly = {
  getImportsFromCode,
  getCodeDepsCache,
  resetCodeDepsCache,
}
