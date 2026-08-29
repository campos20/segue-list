import { moveItem } from "./reorder";

describe("moveItem", () => {
  it("swaps an item with its predecessor when moving up", () => {
    expect(moveItem(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
  });

  it("swaps an item with its successor when moving down", () => {
    expect(moveItem(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"]);
  });

  it("returns the same reference when moving the first item up", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, "up")).toBe(items);
  });

  it("returns the same reference when moving the last item down", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 2, "down")).toBe(items);
  });

  it("does not mutate the original array", () => {
    const items = ["a", "b", "c"];
    moveItem(items, 1, "up");
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("returns the same reference on a single-item list", () => {
    const items = ["a"];
    expect(moveItem(items, 0, "up")).toBe(items);
    expect(moveItem(items, 0, "down")).toBe(items);
  });
});
