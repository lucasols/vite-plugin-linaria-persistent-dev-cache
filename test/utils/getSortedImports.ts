export function getSortedImports(imports: { fileId: string }[]) {
  return imports.map((item) => item.fileId).sort();
}
