import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sortBy } from "../test/utils/sortBy";

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
    if (include.some((pattern) => pattern.test(path!))) {
      imports.push(path!);
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

  // FIX: change order based on file name casing, ex: ReactComp -> .tsx

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

export function getCodeDepsCache() {
  return codeDepsCache;
}

type Debug = {
  cached: number;
  notCached: number;
  addedToCache: number;
  timing: number;
  getAllCodeDepsCalls: number;
};

function getAllCodeDeps(
  fileId: string,
  code: string,
  include: RegExp[],
  rootDir: string,
  aliases: Aliases,
  debug: Debug,
  rootFileInfo = {
    fileId: fileId,
    imports: new Set<string>(),
  },
  deep = 0
): { deps: CodeDependency[]; skipedSomeImport: boolean } {
  debug.getAllCodeDepsCalls++;

  if (codeDepsCache.has(fileId)) {
    debug.cached++;
    return { deps: codeDepsCache.get(fileId)!.deps, skipedSomeImport: false };
  }

  const codeImports = getImportsFromCode(code, include);
  const deps = new Map<string, CodeDependency>();

  let skipedSomeImport = false;

  for (const importPath of codeImports) {
    if (deps.has(importPath)) {
      continue;
    }

    if (rootFileInfo.imports.has(importPath)) {
      skipedSomeImport = true;
      continue;
    }

    const resolvedFiledId = getResolvedPath(importPath, aliases, rootDir);

    if (!resolvedFiledId) {
      continue;
    }

    if (rootFileInfo.fileId === resolvedFiledId) {
      skipedSomeImport = true;
      continue;
    }

    rootFileInfo.imports.add(importPath);

    const code = fs.readFileSync(resolvedFiledId, "utf8");

    deps.set(importPath, { fileId: resolvedFiledId, code, importPath });

    const importDeps = getAllCodeDeps(
      resolvedFiledId,
      code,
      include,
      rootDir,
      aliases,
      debug,
      rootFileInfo,
      deep + 1
    );

    if (importDeps.skipedSomeImport && deep > 0) {
      skipedSomeImport = true;
    }

    for (const importResult of importDeps.deps) {
      deps.set(importResult.importPath, importResult);
    }
  }

  const depsArray: CodeDependency[] = [];
  const depsId: Set<string> = new Set();

  for (const dependency of deps.values()) {
    depsId.add(dependency.fileId);
    depsArray.push(dependency);
  }

  if (!skipedSomeImport) {
    debug.addedToCache++;

    codeDepsCache.set(fileId, {
      deps: depsArray,
      depsId: depsId,
    });
  }

  debug.notCached++;

  return { deps: depsArray, skipedSomeImport };
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
): {
  hash: string;
  importsMap: CodeDependency[];
  debug: Debug;
} {
  // FIX: make debug optional
  const debug: Debug = {
    cached: 0,
    notCached: 0,
    addedToCache: 0,
    timing: 0,
    getAllCodeDepsCalls: 0,
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

  for (const { code, fileId } of importsMap.deps) {
    importsHash += generateStringHash(`${fileId}||${code}`);
  }

  debug.timing = Date.now() - start;

  return {
    hash: `${codeHash}||${generateStringHash(importsHash)}`,
    importsMap: importsMap.deps,
    debug,
  };
}

export function resetCodeDepsCache() {
  codeDepsCache.clear();
  codeDepsCacheFilesIds.clear();
}
