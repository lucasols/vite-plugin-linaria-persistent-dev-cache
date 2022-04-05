import { describe, expect, test } from "vitest";
import { resetCodeDepsCache } from "../src/file-dep-hash";
import { getPrivateFileDepHash } from "./utils/setup";

describe.skip("caches the deps of previous calls", () => {
  describe("Table then", () => {
    test.only("cached files", () => {
      const tableResult = getPrivateFileDepHash(
        "./src/components/Table/Table.tsx"
      );

      console.log(tableResult.debug.timing);

      expect(tableResult.debug.addedToCache).toEqual(727);
      expect(tableResult.importsMap.length).toEqual(727);
    });

    test("Table second call", () => {
      const tableResult2 = getPrivateFileDepHash(
        "./src/components/Table/Table.tsx"
      );

      expect(tableResult2.importsMap.length).toEqual(727);

      expect(tableResult2.debug.timing).toBeLessThan(50);

      expect(tableResult2.debug.cached).toEqual(727);
      expect(tableResult2.debug.notCached).toEqual(0);
    });

    test("Dropdown", () => {
      const result = getPrivateFileDepHash(
        "./src/components/Dropdown/Dropdown.tsx"
      );

      expect(result.importsMap.length).toEqual(6);

      expect(result.debug.cached).toEqual(1);
      expect(result.debug.notCached).toEqual(0);
    });

    test("MoreMenu", () => {
      const result = getPrivateFileDepHash("./src/components/MoreMenu.tsx");

      expect(result.importsMap.length).toEqual(29);

      expect(result.debug.cached).toEqual(1);
      expect(result.debug.notCached).toEqual(0);
    });
  });

  test("MoreMenu then DropDown", () => {
    resetCodeDepsCache();

    const moreMenuResult = getPrivateFileDepHash(
      "./src/components/MoreMenu.tsx"
    );

    expect(moreMenuResult.importsMap.length).toEqual(29);
    expect(moreMenuResult.debug.cached).toEqual(0);

    const dropdownResult = getPrivateFileDepHash(
      "./src/components/Dropdown/Dropdown.tsx"
    );

    expect(dropdownResult.importsMap.length).toEqual(6);
    expect(dropdownResult.debug.cached).toEqual(1);
    expect(dropdownResult.debug.notCached).toEqual(0);
  });
});
