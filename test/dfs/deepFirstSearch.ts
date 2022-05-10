export type Graph = Record<string, string[]>

const resolvedCache = new Map<string, Set<string> | false>()

type DeepFirstSearchResult = {
  deps: Set<string>
  hasCircularDep: boolean
}

export function deepFirstSearch(
  nodes: Graph,
  startNode: string,
  visited: Set<string> = new Set(),
  inPath: Set<string> = new Set(),
  deepth = 0,
): DeepFirstSearchResult {
  visited.add(startNode)
  inPath.add(startNode)

  const edges = nodes[startNode]!

  const deps = new Set<string>()

  let isCircular = false

  for (const edge of edges) {
    if (inPath.has(edge)) {
      isCircular = true
      continue
    }

    let edgeHasCircularDep = false

    if (!visited.has(edge)) {
      edgeHasCircularDep = deepFirstSearch(
        nodes,
        edge,
        visited,
        inPath,
        deepth + 1,
      ).hasCircularDep
    } else {
      edgeHasCircularDep = resolvedCache.get(edge) === false
    }

    if (edgeHasCircularDep) {
      isCircular = true
      continue
    }

    deps.add(edge)

    addEdgeDeps(edge, deps)
  }

  inPath.delete(startNode)

  if (deepth === 0) {
    visited.delete(startNode)
  }

  if (isCircular) {
    if (deepth === 0) {
      resolvedCache.set(startNode, visited)
    } else {
      resolvedCache.set(startNode, false)
    }
  } else {
    resolvedCache.set(startNode, deps)
  }

  return { deps: visited, hasCircularDep: isCircular }
}

function addEdgeDeps(edge: string, deps: Set<string>) {
  const edgeDeps = resolvedCache.get(edge)

  if (edgeDeps) {
    for (const dep of edgeDeps) {
      deps.add(dep)
    }
  }
}

export function cleanResolvedCache() {
  resolvedCache.clear()
}

export function getResolvedCache() {
  return resolvedCache
}
