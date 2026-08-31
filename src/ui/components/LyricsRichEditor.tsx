import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ColorSpan } from "@/ui/lyricsColor";
import { sanitizeLyricsHtml } from "@/ui/lyricsColor";
import { radii, useThemeColors, type ThemeColors } from "@/ui/theme";

export interface LyricsRichEditorHandle {
  applyColor: (span: ColorSpan) => void;
  clearColor: () => void;
}

interface LyricsRichEditorProps {
  value: string;
  onChangeText: (html: string) => void;
  onSelectionChange: (hasSelection: boolean, span: ColorSpan | null) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
}

const LYRICS_FONT_FAMILY = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

/**
 * A `contenteditable` surface running inside a WebView, so font/background
 * color applies live in place - genuine WYSIWYG - rather than through raw
 * `<span>` markup shown as text (which was tried first as a plain
 * TextInput + a separate preview, and found uncomfortable to edit with).
 *
 * This is a hand-rolled editor, not an embedded rich-text library: the only
 * formatting need is color, so a full document-editing framework would be
 * substantially more than the feature calls for - and everything it needs
 * (`contenteditable`, `Selection`/`Range`) is bundled inline in the HTML
 * this component builds, with no CDN or external asset. That matters here
 * specifically: this app runs during a live show, where there's no
 * guarantee of a network connection, so a formatting tool that depends on
 * fetching something at runtime isn't an option.
 *
 * The WebView's own DOM is never trusted directly - every message it sends
 * out, and everything injected into it, goes through lyricsColor.ts's
 * parse/build functions, which only ever produce our own constrained
 * `<span style="color:...;background-color:...;">` shape. See
 * sanitizeLyricsHtml's doc comment for why that matters on the way in.
 */
export const LyricsRichEditor = forwardRef<
  LyricsRichEditorHandle,
  LyricsRichEditorProps
>(function LyricsRichEditor(
  { value, onChangeText, onSelectionChange, placeholder, style },
  ref,
) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  // The content the WebView currently has loaded, so an outgoing `change`
  // message doesn't get treated as an external `value` change and
  // re-injected - only a genuinely different value (switching songs) does.
  const loadedValueRef = useRef<string | null>(null);

  const html = useMemo(
    () => buildEditorHtml(colors, placeholder),
    [colors, placeholder],
  );

  useEffect(() => {
    if (!isReady) return;
    if (value === loadedValueRef.current) return;
    loadedValueRef.current = value;
    webViewRef.current?.injectJavaScript(
      `window.__setContent(${JSON.stringify(sanitizeLyricsHtml(value))}); true;`,
    );
  }, [isReady, value]);

  useImperativeHandle(ref, () => ({
    applyColor(span) {
      webViewRef.current?.injectJavaScript(
        `window.__applyColor(${JSON.stringify(span.color ?? "")}, ${JSON.stringify(span.background ?? "")}); true;`,
      );
    },
    clearColor() {
      webViewRef.current?.injectJavaScript(`window.__clearColor(); true;`);
    },
  }));

  function handleMessage(event: WebViewMessageEvent) {
    let message: { type?: string; payload?: unknown };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "ready") {
      setIsReady(true);
    } else if (
      message.type === "change" &&
      typeof message.payload === "string"
    ) {
      loadedValueRef.current = message.payload;
      onChangeText(message.payload);
    } else if (message.type === "selection") {
      const payload = message.payload as
        { hasSelection?: boolean; span?: ColorSpan | null } | undefined;
      onSelectionChange(Boolean(payload?.hasSelection), payload?.span ?? null);
    }
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        style={styles.webview}
        keyboardDisplayRequiresUserAction={false}
      />
    </View>
  );
});

/** Converts a browser-computed `rgb(r, g, b)` string back to `RRGGBB` hex, or `""` if unset/unparseable - built as a plain string so it can be embedded in the injected HTML without any bundler/transpile step. */
const RGB_TO_HEX_JS = `
function rgbToHex(rgbStr) {
  var m = /rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/.exec(rgbStr || "");
  if (!m) return "";
  return [m[1], m[2], m[3]].map(function (v) {
    var h = parseInt(v, 10).toString(16);
    return h.length === 1 ? "0" + h : h;
  }).join("").toUpperCase();
}`;

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Exported (alongside the component itself) so the editor's actual
 * injected HTML/JS can be loaded directly in a real browser for testing -
 * react-native-webview has no web implementation, so this is the only way
 * to exercise the contenteditable/Selection/Range logic outside a device.
 */
export function buildEditorHtml(
  colors: ThemeColors,
  placeholder: string,
): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin:0; padding:0; height:100%; background:${colors.background}; }
  body { -webkit-text-size-adjust: 100%; }
  #editor {
    box-sizing: border-box;
    min-height: 100%;
    padding: 16px;
    font-family: ${LYRICS_FONT_FAMILY};
    font-size: 18px;
    line-height: 28px;
    color: ${colors.textPrimary};
    outline: none;
    white-space: pre-wrap;
    word-wrap: break-word;
    -webkit-user-select: text;
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: ${colors.textTertiary};
    pointer-events: none;
  }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${escapeHtmlAttr(placeholder)}"></div>
<script>
(function () {
  var editor = document.getElementById("editor");

  function post(type, payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
  }
  ${RGB_TO_HEX_JS}

  function escapeText(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Walks the editor's DOM and emits our own constrained grammar (text,
  // <span style="color:...;background-color:...;">, and a literal "\\n"
  // for any block-level break a paste might have introduced) - never the
  // browser's own innerHTML, which can vary in shape between engines and
  // isn't guaranteed to match what we're willing to parse back in.
  function serialize(root) {
    var out = "";
    function walk(node) {
      if (node.nodeType === 3) {
        out += escapeText(node.nodeValue);
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === "BR") {
        out += "\\n";
        return;
      }
      if (tag === "SPAN") {
        var colorHex = rgbToHex(node.style.color);
        var bgHex = rgbToHex(node.style.backgroundColor);
        if (colorHex || bgHex) {
          var style = "";
          if (colorHex) style += "color:#" + colorHex + ";";
          if (bgHex) style += "background-color:#" + bgHex + ";";
          out += '<span style="' + style + '">';
          for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
          out += "</span>";
          return;
        }
      }
      if (tag === "DIV" || tag === "P") {
        if (out.length > 0) out += "\\n";
      }
      for (var j = 0; j < node.childNodes.length; j++) walk(node.childNodes[j]);
    }
    for (var k = 0; k < root.childNodes.length; k++) walk(root.childNodes[k]);
    return out;
  }

  function notifyChange() {
    post("change", serialize(editor));
  }

  // The <span> (if any) that fully encloses range's common ancestor -
  // used both to report the selection's current color back to React Native
  // (currentSpan, for pre-filling the picker) and, further down, to decide
  // whether applying/clearing color should update that same span in place
  // rather than wrap or extract a new one.
  function enclosingSpan(range) {
    var container = range.commonAncestorContainer;
    var el = container.nodeType === 1 ? container : container.parentElement;
    var span = el && el.closest ? el.closest("span") : null;
    return span && editor.contains(span) ? span : null;
  }

  function currentSpan(range) {
    var span = enclosingSpan(range);
    if (!span) return null;
    var colorHex = rgbToHex(span.style.color);
    var bgHex = rgbToHex(span.style.backgroundColor);
    if (!colorHex && !bgHex) return null;
    return { color: colorHex || undefined, background: bgHex || undefined };
  }

  // Enter is deliberately NOT intercepted: hand-rolling it via the
  // Range/Selection API (inserting a "\\n" text node, or even a real <br>
  // element, then manually repositioning the caret) turns out to be
  // unreliable for the very next native keystroke in this engine - the
  // Range/Selection state reads back as correct by every property, but the
  // browser's own caret-continuity tracking doesn't honor it, and typing
  // lands in the wrong place. The browser's own default Enter handling
  // (confirmed by hand: reliable, ordinary sequential typing) produces
  // <div>-wrapped lines, which serialize() above already treats as "\\n" -
  // so the stored format stays exactly as intended either way.
  editor.addEventListener("input", notifyChange);

  // Plain text only - a paste carrying foreign HTML (images, scripts, other
  // sites' markup) never enters the editor's DOM in the first place, so
  // there's nothing but our own <span> elements for serialize() to ever see.
  // document.execCommand is legacy, but for plain-text insertion (as
  // opposed to hand-rolling line breaks with it, which is what actually
  // caused trouble above) it behaves reliably here.
  editor.addEventListener("paste", function (e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
    notifyChange();
  });

  document.addEventListener("selectionchange", function () {
    var sel = window.getSelection();
    var hasSelection = false;
    var span = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      var range = sel.getRangeAt(0);
      hasSelection = editor.contains(range.commonAncestorContainer);
      if (hasSelection) span = currentSpan(range);
    }
    post("selection", { hasSelection: hasSelection, span: span });
  });

  window.__setContent = function (html) {
    // Mirrors serialize()'s <br> -> "\\n" in reverse: the stored format
    // keeps line breaks as literal "\\n" characters, but the live DOM needs
    // real <br> elements for caret positioning to behave (see insertLines).
    editor.innerHTML = html.replace(/\\n/g, "<br>");
  };

  // Both apply and clear reuse enclosingSpan() above, so the color the
  // picker shows as "currently applied" is always the same span these two
  // actually act on - selecting an already-colored phrase and changing (or
  // clearing) its color updates that span directly, rather than wrapping a
  // second span inside the first or trying to surgically re-splice a range
  // that sits entirely inside an existing span's text (extractContents
  // there only pulls out the text, not the span itself, so a naive
  // extract/reinsert puts the "unwrapped" content right back inside the
  // still-present span - found by hand, not theoretical).
  window.__applyColor = function (color, background) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    var existing = enclosingSpan(range);
    if (existing) {
      existing.style.color = color ? "#" + color : "";
      existing.style.backgroundColor = background ? "#" + background : "";
      sel.removeAllRanges();
      notifyChange();
      return;
    }
    var span = document.createElement("span");
    if (color) span.style.color = "#" + color;
    if (background) span.style.backgroundColor = "#" + background;
    try {
      range.surroundContents(span);
    } catch (e) {
      // The selection's start/end land inside different existing elements
      // - surroundContents can't handle that in one step, so extract and
      // re-wrap instead.
      var content = range.extractContents();
      span.appendChild(content);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    notifyChange();
  };

  window.__clearColor = function () {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    var span = enclosingSpan(range);
    if (!span) return;
    var parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    sel.removeAllRanges();
    notifyChange();
  };

  post("ready", null);
})();
</script>
</body>
</html>`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    webview: {
      flex: 1,
      backgroundColor: "transparent",
    },
  });
}
