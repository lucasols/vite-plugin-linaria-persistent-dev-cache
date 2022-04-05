import { beforeEach, describe, expect, test } from "vitest";
import { resetCodeDepsCache } from "../src/file-dep-hash";
import { getPrivateFileDepHash } from "./utils/setup";

beforeEach(() => {
  resetCodeDepsCache();
});

describe("get the correct deps for a file", () => {
  let tableResult: ReturnType<typeof getPrivateFileDepHash>;

  test("Table deps", () => {
    tableResult = getPrivateFileDepHash("./src/components/Table/Table.tsx");
    expect(tableResult.importsMap.length).toEqual(727);

    expect(tableResult.importsMap.map((item) => item.fileId)).toMatchSnapshot();
  });

  test("result import values are not equal", () => {
    const [a, b] = tableResult.importsMap;

    expect(a === b).toBe(false);
  });

  test("Dropdown deps", () => {
    const result = getPrivateFileDepHash("./src/components/Dropdown/Dropdown.tsx");

    expect(result.importsMap.length).toEqual(6);

    expect(result.importsMap.map((item) => item.fileId)).toMatchSnapshot();
  });

  test("MoreMenu deps", () => {
    const result = getPrivateFileDepHash("./src/components/MoreMenu.tsx");

    expect(result.importsMap.length).toEqual(29);

    expect(result.importsMap.map((item) => item.fileId)).toMatchSnapshot();
  });
});
