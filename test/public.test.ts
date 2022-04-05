import { beforeEach, describe, expect, test } from "vitest";
import { resetCodeDepsCache } from "../src/file-dep-hash";
import { getSortedImports } from "./utils/getSortedImports";
import { getPublicFileDepHash } from "./utils/setup";

beforeEach(() => {
  resetCodeDepsCache();
});

test("simple case", () => {
  const result = getPublicFileDepHash("./src/base/base.tsx");

  expect(result.importsMap.length).toEqual(2);
  expect(getSortedImports(result.importsMap)).toMatchSnapshot();
});

test("circular dependency", () => {
  const result = getPublicFileDepHash("./src/circular/circular.tsx");

  expect(result.importsMap.length).toEqual(2);
  expect(getSortedImports(result.importsMap)).toMatchSnapshot();
});
