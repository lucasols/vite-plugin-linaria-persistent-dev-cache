import { beforeEach, expect, test } from 'vitest'
import { cleanResolvedCache, deepFirstSearch } from '../src/deepFirstSearch'
import { getDFSStableCache } from './utils/getSortedImports'

beforeEach(() => {
  cleanResolvedCache()
})

test('simple dep calc 1', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3'],
      dep3: [],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3'] },
    { fileId: 'dep2', imports: ['dep3'] },
    { fileId: 'dep3', imports: [] },
  ])
})

test('simple dep calc 2', () => {
  deepFirstSearch(
    {
      dep1: ['dep2', 'dep4'],
      dep2: ['dep3'],
      dep3: [],
      dep4: ['dep5'],
      dep5: [],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3', 'dep4', 'dep5'] },
    { fileId: 'dep2', imports: ['dep3'] },
    { fileId: 'dep3', imports: [] },
    { fileId: 'dep4', imports: ['dep5'] },
    { fileId: 'dep5', imports: [] },
  ])
})

test('circular dep calc', () => {
  deepFirstSearch(
    {
      circular: ['dep1'],
      dep1: ['dep2'],
      dep2: ['circular'],
    },
    'circular',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'circular', imports: ['dep1', 'dep2'] },
    { fileId: 'dep1', imports: 'circular' },
    { fileId: 'dep2', imports: 'circular' },
  ])
})

test('circular 2', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3'],
      dep3: ['dep2'],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3'] },
    { fileId: 'dep2', imports: 'circular' },
    { fileId: 'dep3', imports: 'circular' },
  ])
})

test('circular 3', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3', 'dep4'],
      dep3: ['dep2'],
      dep4: ['dep2', 'dep5'],
      dep5: ['dep1'],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3', 'dep4', 'dep5'] },
    { fileId: 'dep2', imports: 'circular' },
    { fileId: 'dep3', imports: 'circular' },
    { fileId: 'dep4', imports: 'circular' },
    { fileId: 'dep5', imports: 'circular' },
  ])
})

test('circular 4', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3', 'dep4'],
      dep3: ['dep2'],
      dep4: ['dep2', 'dep5'],
      dep5: ['dep3'],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3', 'dep4', 'dep5'] },
    { fileId: 'dep2', imports: 'circular' },
    { fileId: 'dep3', imports: 'circular' },
    { fileId: 'dep4', imports: 'circular' },
    { fileId: 'dep5', imports: 'circular' },
  ])
})

test('non cyclic graph', () => {
  const result = deepFirstSearch(
    {
      a: ['b', 'c'],
      b: ['d'],
      c: ['d'],
      d: [],
    },
    'a',
  )

  expect(result.deps).toMatchInlineSnapshot(`
    Set {
      "b",
      "d",
      "c",
    }
  `)

  expect(getDFSStableCache()).toStrictEqual([
    {
      fileId: 'a',
      imports: ['b', 'c', 'd'],
    },
    {
      fileId: 'b',
      imports: ['d'],
    },
    {
      fileId: 'c',
      imports: ['d'],
    },
    {
      fileId: 'd',
      imports: [],
    },
  ])
})

test('circular 5', () => {
  const result = deepFirstSearch(
    {
      dropdown: ['popover', 'typings', 'uOCO', 'uDVU'],
      popover: ['portalLayer'],
      portalLayer: [],
      typings: [],
      uOCO: [],
      uDVU: ['useTimout'],
      useTimout: ['typings'],
    },
    'dropdown',
  )

  expect(result.deps).toMatchInlineSnapshot(`
    Set {
      "popover",
      "portalLayer",
      "typings",
      "uOCO",
      "uDVU",
      "useTimout",
    }
  `)

  expect(getDFSStableCache()).toStrictEqual([
    {
      fileId: 'dropdown',
      imports: [
        'popover',
        'portalLayer',
        'typings',
        'uDVU',
        'uOCO',
        'useTimout',
      ],
    },
    {
      fileId: 'popover',
      imports: ['portalLayer'],
    },
    {
      fileId: 'portalLayer',
      imports: [],
    },
    {
      fileId: 'typings',
      imports: [],
    },
    {
      fileId: 'uDVU',
      imports: ['typings', 'useTimout'],
    },
    {
      fileId: 'uOCO',
      imports: [],
    },
    {
      fileId: 'useTimout',
      imports: ['typings'],
    },
  ])
})
