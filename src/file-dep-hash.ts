import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function generateStringHash(str: string) {
  return crypto.createHash('sha1').update(str).digest('hex')
}

type Aliases = {
  find: string | RegExp
  replacement: string
}[]

function getImportsFromCode(
  code: string,
  include: RegExp[],
  exclude: RegExp[],
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
    if (
      typeof find === 'string'
        ? normalizedPath.startsWith(find)
        : find.test(normalizedPath)
    ) {
      normalizedPath = normalizedPath.replace(find, replacement)
    }
  }

  normalizedPath = path.posix.join(rootDir, normalizedPath)

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
  aliases: Aliases,
  rootDir: string,
): string {
  let code: string

  try {
    code = fs.readFileSync(resolvedPath, 'utf8')
  } catch (e) {
    for (const [unresolved, resolved] of resolveCache) {
      if (resolved === resolvedPath) {
        resolveCache.delete(unresolved)

        const resolvedPath = getResolvedPath(unresolved, aliases, rootDir)

        if (resolvedPath) {
          return getCodeFromResolvedPath(resolvedPath, aliases, rootDir)
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

const codeDepsCache = new Map<
  string,
  { deps: CodeDependency[]; depsId: Set<string> } | false
>()

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
  exclude: RegExp[],
  aliases: Aliases,
  rootDir: string,
): string[] {
  const imports = getImportsFromCode(code, include, exclude)

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

function mergeEdgeDeps(edge: string, deps: Map<string, string>) {
  const cacheEntry = codeDepsCache.get(edge)

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
  include: RegExp[],
  exclude: RegExp[],
  rootDir: string,
  aliases: Aliases,
  debug: Debug,
  visited: Map<string, string> = new Map(),
  inPath: Set<string> = new Set(),
  deepth = 0,
): { deps: CodeDependency[]; hasCircularDep: boolean } {
  debug.getAllCodeDepsCalls++

  const cachedValue = codeDepsCache.get(fileId)

  if (cachedValue) {
    debug.cached++

    return { deps: cachedValue.deps, hasCircularDep: false }
  }

  visited.set(fileId, code)
  inPath.add(fileId)

  const edges = getEdges(code, include, exclude, aliases, rootDir)

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
      edgeCode = getCodeFromResolvedPath(edge, aliases, rootDir)

      edgeHasCircularDep = getAllCodeDeps(
        edge,
        edgeCode,
        include,
        exclude,
        rootDir,
        aliases,
        debug,
        visited,
        inPath,
        deepth + 1,
      ).hasCircularDep
    } else {
      edgeHasCircularDep = !codeDepsCache.get(edge)

      edgeCode = visited.get(edge)!
    }

    if (edgeHasCircularDep) {
      hasCircularDep = true
      continue
    }

    deps.set(edge, edgeCode)

    mergeEdgeDeps(edge, deps)
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
      codeDepsCache.set(fileId, {
        deps: depsArray,
        depsId,
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
    populateDepsArray(deps, depsArray, depsId)

    debug.addedToCache++
    codeDepsCache.set(fileId, {
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

const changedAfterInitialBuild = new Set<string>()

export function cleanCodeDepsCacheForFile(fileId: string) {
  if (!changedAfterInitialBuild.has(fileId)) {
    changedAfterInitialBuild.add(fileId)
    return
  }

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

export function getCodeHash(
  fileId: string,
  code: string,
  include: RegExp[],
  exclude: RegExp[],
  aliases: Aliases,
  rootDir: string,
): {
  hash: string
  importsMap: CodeDependency[]
  debug: Debug
} {
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
    exclude,
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
  changedAfterInitialBuild.clear()
}

export const testOnly = {
  getImportsFromCode,
  getCodeDepsCache,
  resetCodeDepsCache,
}
