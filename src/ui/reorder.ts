/** Swaps the item at `index` with its neighbor one step toward `direction`. Returns `items` unchanged (same reference) at either end of the list. */
export function moveItem<T>(
  items: T[],
  index: number,
  direction: "up" | "down",
): T[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
