const compactHeightRatios = [0.72, 0.84, 0.78, 0.68] as const;

export function splitMasonryColumns<T>(items: readonly T[]) {
  return items.reduce(
    (columns, item, index) => {
      if (index % 2 === 0) {
        columns.left.push(item);
      } else {
        columns.right.push(item);
      }

      return columns;
    },
    { left: [] as T[], right: [] as T[] }
  );
}

export function getCompactFeedImageHeight(cardWidth: number, index: number) {
  const ratio = compactHeightRatios[index % compactHeightRatios.length];
  const rawHeight = Math.round(cardWidth * ratio);

  return Math.min(148, Math.max(108, rawHeight));
}
