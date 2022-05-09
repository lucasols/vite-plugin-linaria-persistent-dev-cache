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
  { deps: CodeDependency[]; depsId: Set<string> }
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

function getAllCodeDeps(
  fileId: string,
  code: string,
  include: RegExp[],
  rootDir: string,
  aliases: Aliases,
  debug: Debug,
  ancestors: string[] = [],
  resolved = new Map<string, CodeDependency>(),
  deep = 0,
): { deps: CodeDependency[]; isCircularDep: boolean } {
  debug.getAllCodeDepsCalls++

  if (codeDepsCache.has(fileId)) {
    debug.cached++
    return { deps: codeDepsCache.get(fileId)!.deps, isCircularDep: false }
  }

  ancestors.push(fileId)

  const edges = getEdges(code, include, aliases, rootDir)

  let isCircularDep = false

  for (const edge of edges) {
    if (resolved.has(edge)) {
      continue
    }

    if (ancestors.includes(edge)) {
      isCircularDep = true
      continue
    }

    const edgeCode = fs.readFileSync(edge, 'utf8')

    const childDeps = getAllCodeDeps(
      edge,
      edgeCode,
      include,
      rootDir,
      aliases,
      debug,
      ancestors,
      resolved,
      deep + 1,
    )

    if (childDeps.isCircularDep && deep !== 0) {
      isCircularDep = true
    }

    for (const dep of childDeps.deps) {
      resolved.set(dep.fileId, dep)
    }
  }

  ancestors.splice(ancestors.indexOf(fileId), 1)
  resolved.set(fileId, { fileId, code })

  const depsArray: CodeDependency[] = []
  const depsId: Set<string> = new Set()

  for (const dependency of resolved.values()) {
    if (dependency.fileId === fileId) {
      continue
    }

    depsId.add(dependency.fileId)
    depsArray.push(dependency)
  }

  if (!isCircularDep) {
    debug.addedToCache++

    codeDepsCache.set(fileId, {
      deps: depsArray,
      depsId: depsId,
    })
  }

  debug.notCached++

  return { deps: depsArray, isCircularDep }
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
