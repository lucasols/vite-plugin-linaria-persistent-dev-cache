import assert from 'assert/strict'

type Graph = Record<string, string[]>

function deepFirstSearch(
  nodes: Graph,
  startNode: string,
  visited: Set<string> = new Set(),
  resolved: Graph = {},
) {
  visited.add(startNode)

  const edges = nodes[startNode]!

  const deps: string[] = []

  for (const edge of edges) {
    if (!visited.has(edge)) {
      deepFirstSearch(nodes, edge, visited, resolved)
    }

    deps.push(edge, ...(resolved[edge] || []))
  }

  resolved[startNode] = [...deps].sort()

  return { visited, resolved }
}

const results = deepFirstSearch(
  {
    dep1: ['dep2'],
    dep2: ['dep3'],
    dep3: [],
  },
  'dep1',
).resolved

results

assert.deepEqual(results, {
  dep1: ['dep2', 'dep3'],
  dep2: ['dep3'],
  dep3: [],
})

assert.deepEqual(
  deepFirstSearch(
    {
      dep1: ['dep2', 'dep4'],
      dep2: ['dep3'],
      dep3: [],
      dep4: ['dep5'],
      dep5: [],
    },
    'dep1',
  ).resolved,
  {
    dep1: ['dep2', 'dep3', 'dep4', 'dep5'],
    dep2: ['dep3'],
    dep3: [],
    dep4: ['dep5'],
    dep5: [],
  },
)

const circularResult = deepFirstSearch(
  {
    circular: ['dep1'],
    dep1: ['dep2'],
    dep2: ['circular'],
  },
  'circular',
).resolved

assert.deepEqual(circularResult, {
  circular: ['dep1', 'dep2'],
  dep1: ['dep2', 'circular'],
  dep2: ['circular', 'dep1'],
})
