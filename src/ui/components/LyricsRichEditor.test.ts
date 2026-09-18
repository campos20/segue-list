import { JSDOM } from "jsdom";
import { darkColors } from "@/ui/theme";
import { buildEditorHtml } from "./lyricsEditorHtml";

/**
 * Drives the editor's actual embedded HTML/JS through jsdom
 * (`runScripts: "dangerously"`) rather than a reimplementation of
 * `serialize()` - react-native-webview has no web/Node implementation, so
 * this is the only way to exercise the real production string outside a
 * device. See buildEditorHtml's doc comment and AGENTS.md's "blank lines
 * doubling" incident.
 */
function loadEditor() {
  const messages: { type: string; payload: unknown }[] = [];
  const html = buildEditorHtml(darkColors, "placeholder");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    beforeParse(window) {
      // window.ReactNativeWebView only exists inside the real native bridge
      // - the script no-ops post() without it (see buildEditorHtml). Mocking
      // it here is how the file's own doc comment says this HTML is meant
      // to be tested outside a device.
      (
        window as unknown as { ReactNativeWebView: unknown }
      ).ReactNativeWebView = {
        postMessage(data: string) {
          messages.push(JSON.parse(data));
        },
      };
    },
  });
  const editor = dom.window.document.getElementById("editor")!;

  /** Sets the editor's DOM directly (simulating whatever shape the browser's own contenteditable Enter handling produced) and returns the resulting serialized change. */
  function serialize(innerHTML: string): string {
    editor.innerHTML = innerHTML;
    editor.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    const last = messages[messages.length - 1];
    if (last?.type !== "change" || typeof last.payload !== "string") {
      throw new Error(`Expected a change message, got ${JSON.stringify(last)}`);
    }
    return last.payload;
  }

  return { serialize, messages };
}

describe("LyricsRichEditor's serialize()", () => {
  it("joins ordinary div-per-line content with a single newline", () => {
    const { serialize } = loadEditor();
    expect(serialize("<div>Line one</div><div>Line two</div>")).toBe(
      "Line one\nLine two",
    );
  });

  it("renders a <div><br></div> in the middle as exactly one blank line, not two", () => {
    const { serialize } = loadEditor();
    expect(
      serialize("<div>Line one</div><div><br></div><div>Line two</div>"),
    ).toBe("Line one\n\nLine two");
  });

  it("renders a leading <div><br></div> as exactly one leading blank line", () => {
    const { serialize } = loadEditor();
    expect(serialize("<div><br></div><div>Line two</div>")).toBe("\nLine two");
  });

  it("renders a trailing <div><br></div> as exactly one trailing blank line", () => {
    const { serialize } = loadEditor();
    expect(serialize("<div>Line one</div><div><br></div>")).toBe("Line one\n");
  });

  it("handles several consecutive blank lines without inflating them", () => {
    const { serialize } = loadEditor();
    expect(
      serialize("<div>A</div><div><br></div><div><br></div><div>B</div>"),
    ).toBe("A\n\n\nB");
  });

  it("still counts a <br> that sits alongside real content in the same div (a Shift+Enter soft break)", () => {
    const { serialize } = loadEditor();
    expect(serialize("<div>Line one<br>continued</div>")).toBe(
      "Line one\ncontinued",
    );
  });

  it("handles flat <br>-separated content with no divs at all (what __setContent produces)", () => {
    const { serialize } = loadEditor();
    expect(serialize("Line one<br>Line two<br>Line three")).toBe(
      "Line one\nLine two\nLine three",
    );
  });

  it("keeps colored spans intact alongside a blank line", () => {
    const { serialize } = loadEditor();
    expect(
      serialize(
        '<div><span style="color: rgb(255, 0, 0);">Red</span></div><div><br></div><div>Next</div>',
      ),
    ).toBe('<span style="color:#FF0000;">Red</span>\n\nNext');
  });

  // A real document can mix flat (un-wrapped) top-level content with
  // <div>-wrapped top-level content: Chrome only starts wrapping lines in
  // <div> once Enter is actually pressed inside the editor, so content
  // loaded via __setContent (flat text/<br> siblings) that's then edited
  // partway through ends up with flat content before the edit point and
  // <div>-wrapped content from the edit point on. These DOM shapes are
  // taken verbatim from a real Chromium repro (typing "refrão" then Enter
  // right before an existing line, with two flat lines and a blank line
  // already above it) - see AGENTS.md's "blank lines doubling" incident,
  // which this bug was a regression of that same fix.
  it("puts a newline between flat top-level content and a <div> that follows it, not merging them", () => {
    const { serialize } = loadEditor();
    expect(
      serialize(
        "Line one<br>Line two<br><br>refrão<div>Line three<br>Line four</div>",
      ),
    ).toBe("Line one\nLine two\n\nrefrão\nLine three\nLine four");
  });

  it("puts a newline before every <div> that follows flat content, not just the first one", () => {
    const { serialize } = loadEditor();
    expect(
      serialize("Line one<br>Line two<div>Three</div><div>Four</div>"),
    ).toBe("Line one\nLine two\nThree\nFour");
  });

  it("handles a <div> whose content starts with its own leading <br>s (a multi-line <div>, not one line per <div>)", () => {
    const { serialize } = loadEditor();
    expect(
      serialize(
        "Line one<br>Line two<div>refrão</div><div><br><br>Line three<br>Line four</div>",
      ),
    ).toBe("Line one\nLine two\nrefrão\n\n\nLine three\nLine four");
  });
});
