type Options = { descending?: boolean };

export function sortBy<T>(
  arr: T[],
  sortByValue: (item: T) => number | string,
  { descending }: Options = {}
) {
  return [...arr].sort((a, b) => {
    const aValue = sortByValue(a);
    const bValue = sortByValue(b);

    if (aValue < bValue) {
      return !descending ? -1 : 1;
    }

    if (aValue > bValue) {
      return !descending ? 1 : -1;
    }

    return 0;
  });
}
