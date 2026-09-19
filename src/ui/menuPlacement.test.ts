import { placeMenu } from "./menuPlacement";

const base = {
  triggerTop: 100,
  triggerHeight: 36,
  windowHeight: 800,
  insetTop: 40,
  insetBottom: 30,
};

describe("placeMenu", () => {
  it("opens just below the trigger before the menu has been measured", () => {
    expect(placeMenu({ ...base, menuHeight: null })).toEqual({ top: 142 });
  });

  it("opens below the trigger when the menu fits there", () => {
    expect(placeMenu({ ...base, menuHeight: 300 })).toEqual({ top: 142 });
  });

  it("opens above the trigger when it doesn't fit below but does above", () => {
    // Trigger near the bottom: 650 + 36 + 6 = 692 leaves 800 - 30 - 8 - 692 = 70 below.
    expect(placeMenu({ ...base, triggerTop: 650, menuHeight: 300 })).toEqual({
      top: 650 - 6 - 300,
    });
  });

  it("caps the height and scrolls below when neither side fits and below has more room", () => {
    const placement = placeMenu({
      ...base,
      windowHeight: 400,
      triggerTop: 80,
      menuHeight: 600,
    });
    expect(placement.top).toBe(122);
    expect(placement.maxHeight).toBe(400 - 30 - 8 - 122);
  });

  it("caps the height and scrolls above when neither side fits and above has more room", () => {
    const placement = placeMenu({
      ...base,
      windowHeight: 400,
      triggerTop: 300,
      menuHeight: 600,
    });
    const spaceAbove = 300 - 6 - (40 + 8);
    expect(placement.maxHeight).toBe(spaceAbove);
    expect(placement.top).toBe(300 - 6 - spaceAbove);
  });

  it("stays clear of the bottom inset", () => {
    // Exactly fills the room below once the inset and edge margin are counted.
    const spaceBelow = 800 - 30 - 8 - 142;
    expect(placeMenu({ ...base, menuHeight: spaceBelow })).toEqual({
      top: 142,
    });
    // One pixel taller: no room above either, so it stays below but is capped.
    expect(placeMenu({ ...base, menuHeight: spaceBelow + 1 })).toEqual({
      top: 142,
      maxHeight: spaceBelow,
    });
  });
});
