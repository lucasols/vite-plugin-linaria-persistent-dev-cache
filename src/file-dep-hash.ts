import crypto from "crypto";
import fs from "fs";
import path from "path";

function generateStringHash(str: string) {
  return crypto.createHash("sha1").update(str).digest("hex");
}

type Aliases = {
  find: string;
  replacement: string;
}[];

function getImportsFromCode(code: string, include: RegExp[]) {
  const regex = /from\s+['"]([^'"]+)['"];/g;

  const allPossibleImports = code.matchAll(regex);

  const imports: string[] = [];

  for (const [_, path] of allPossibleImports) {
    if (include.some((pattern) => pattern.test(path))) {
      imports.push(path);
    }
  }

  return imports;
}

const resolveCache = new Map<string, string>();

function getResolvedPath(
  filePath: string,
  aliases: Aliases,
  rootDir: string
): string | false {
  if (resolveCache.has(filePath)) {
    return resolveCache.get(filePath)!;
  }

  let normalizedPath = filePath;

  for (const { find, replacement } of aliases) {
    if (normalizedPath.startsWith(find)) {
      normalizedPath = normalizedPath.replace(find, replacement);
    }
  }

  normalizedPath = path.posix.join(rootDir, normalizedPath);

  const testSuffix = [".tsx", ".ts", "/index.tsx", "/index.ts"];

  for (const suffix of testSuffix) {
    const testURL = `${normalizedPath}${suffix}`;

    if (fs.statSync(testURL, { throwIfNoEntry: false })) {
      return testURL;
    }
  }

  return false;
}

type CodeDependency = {
  fileId: string;
  importPath: string;
  code: string;
};

const codeDepsCache = new Map<
  string,
  { deps: CodeDependency[]; depsId: Set<string> }
>();
const codeDepsCacheFilesIds = new Set<string>();

type Debug = {
  cached: number;
  notCached: number;
  addedToCache: number;
  timing: number;
};

function getAllCodeDeps(
  fileId: string,
  code: string,
  include: RegExp[],
  rootDir: string,
  aliases: Aliases,
  debug: Debug,
  allDepsFileIds: Set<string> = new Set()
): CodeDependency[] {
  if (codeDepsCache.has(fileId)) {
    debug.cached++;
    return codeDepsCache.get(fileId)!.deps;
  }

  const codeImports = getImportsFromCode(code, include);
  const deps = new Map<string, CodeDependency>();

  allDepsFileIds.add(fileId);

  for (const importPath of codeImports) {
    if (deps.has(importPath)) {
      continue;
    }

    const resolvedFiledId = getResolvedPath(importPath, aliases, rootDir);

    if (!resolvedFiledId) {
      continue;
    }

    if (allDepsFileIds.has(resolvedFiledId)) {
      continue;
    }

    allDepsFileIds.add(resolvedFiledId);

    const code = fs.readFileSync(resolvedFiledId, "utf8");

    deps.set(importPath, { fileId: resolvedFiledId, code, importPath });

    const importDeps = getAllCodeDeps(
      resolvedFiledId,
      code,
      include,
      rootDir,
      aliases,
      debug,
      allDepsFileIds
    );

    for (const importResult of importDeps) {
      deps.set(importResult.importPath, importResult);
    }
  }

  const depsArray: CodeDependency[] = [];
  const depsId: Set<string> = new Set();

  for (const dependency of deps.values()) {
    depsId.add(dependency.fileId);
    depsArray.push(dependency);
  }

  // if (codeImports.length === 0) {
  //   debug.addedToCache++;
  //   codeDepsCache.set(fileId, {
  //     deps: [],
  //     depsId: new Set(),
  //   });
  // }

  debug.notCached++;

  return depsArray;
}

function cleanCodeDepsCacheForFile(fileId: string) {
  if (!codeDepsCacheFilesIds.has(fileId)) {
    // TODO: ignore files in the first build
    return;
  }

  for (const [id, cacheEntry] of codeDepsCache.entries()) {
    if (fileId === id) {
      codeDepsCache.delete(id);
      continue;
    }

    if (cacheEntry.depsId.has(fileId)) {
      codeDepsCache.delete(id);
    }
  }
}

export function getCodeHash(
  fileId: string,
  code: string,
  include: RegExp[],
  aliases: Aliases,
  rootDir: string
) {
  // FIX: make debug optional
  const debug: Debug = {
    cached: 0,
    notCached: 0,
    addedToCache: 0,
    timing: 0,
  };

  const start = Date.now();

  const importsMap = getAllCodeDeps(
    fileId,
    code,
    include,
    rootDir,
    aliases,
    debug
  );

  const codeHash = generateStringHash(code);

  let importsHash = "";

  for (const { code, fileId } of importsMap) {
    importsHash += generateStringHash(`${fileId}||${code}`);
  }

  debug.timing = Date.now() - start;

  return {
    hash: `${codeHash}||${generateStringHash(importsHash)}`,
    importsMap,
    debug,
  };
}

export function resetCodeDepsCache() {
  codeDepsCache.clear();
  codeDepsCacheFilesIds.clear();
}
