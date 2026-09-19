import { setlistToText } from "./setlistText";

describe("setlistToText", () => {
  it("puts the setlist name first, then one numbered line per song in order", () => {
    expect(setlistToText("Friday gig", ["Wonderwall", "Creep", "Yellow"])).toBe(
      "Friday gig\n\n1. Wonderwall\n2. Creep\n3. Yellow",
    );
  });

  it("numbers a song each time it appears", () => {
    expect(setlistToText("Set", ["A", "B", "A"])).toBe(
      "Set\n\n1. A\n2. B\n3. A",
    );
  });

  it("still shows the name for an empty setlist", () => {
    expect(setlistToText("Empty", [])).toBe("Empty\n");
  });
});
