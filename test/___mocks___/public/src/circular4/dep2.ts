import { circularExport } from "@src/circular4/dep3";
import { testDep4 } from '@src/circular4/dep4';

export const hello = "😅";

export const testDep2 = "test";

console.log(circularExport, testDep4);
