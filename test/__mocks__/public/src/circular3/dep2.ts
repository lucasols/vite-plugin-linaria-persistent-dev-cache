import { circularExport } from "@src/circular3/dep3";
import { testDep4 } from '@src/circular3/dep4';

export const hello = "😅";

export const testDep2 = "test";

console.log(circularExport, testDep4);
