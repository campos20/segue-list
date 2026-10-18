import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { buildEditorHtml } from "@/ui/components/lyricsEditorHtml";
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

/**
 * The browser's counterpart to LyricsRichEditor.tsx - same props and
 * handle. react-native-webview has no web implementation, so this hosts the
 * exact same editor document (buildEditorHtml - the code
 * LyricsRichEditor.test.ts exercises) in an `<iframe srcdoc>` instead of a
 * WebView, and only replaces the bridge around it:
 *
 * - Out of the editor: its script already posts through
 *   `window.ReactNativeWebView.postMessage` when that exists. The prelude
 *   below defines it as a `parent.postMessage`, so the editor's own code
 *   runs unchanged.
 * - Into the editor: a WebView's `injectJavaScript` has no iframe
 *   equivalent across a sandbox, so the prelude listens for three commands
 *   and calls the same `window.__setContent`/`__applyColor`/`__clearColor`
 *   the native side injects calls to.
 *
 * The iframe is sandboxed with `allow-scripts` only - no `allow-same-origin`
 * - so the document runs in an opaque origin: it can't reach this page's
 * DOM or its localStorage (where the whole library lives), whatever ends up
 * in it. Messages are matched to this instance by `event.source` plus a
 * per-instance channel id, so two editors (or anything else posting
 * messages) can't cross wires.
 */
function buildPrelude(channel: string): string {
  return `<script>
(function () {
  var CHANNEL = ${JSON.stringify(channel)};
  window.ReactNativeWebView = {
    postMessage: function (data) {
      parent.postMessage({ channel: CHANNEL, data: data }, "*");
    }
  };
  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.command === "setContent") window.__setContent(message.html);
    else if (message.command === "applyColor") window.__applyColor(message.color, message.background);
    else if (message.command === "clearColor") window.__clearColor();
  });
})();
</script>`;
}

type EditorCommand =
  | { command: "setContent"; html: string }
  | { command: "applyColor"; color: string; background: string }
  | { command: "clearColor" };

export const LyricsRichEditor = forwardRef<
  LyricsRichEditorHandle,
  LyricsRichEditorProps
>(function LyricsRichEditor(
  { value, onChangeText, onSelectionChange, placeholder, style },
  ref,
) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(
    () => `lyrics-editor-${Math.random().toString(36).slice(2)}`,
  );
  // Bumped on every "ready" - a theme change rebuilds the document (and so
  // reloads the iframe), and the fresh document needs the content again.
  const [readyCount, setReadyCount] = useState(0);
  // The content the iframe currently has loaded, so an outgoing `change`
  // message doesn't get treated as an external `value` change and
  // re-injected - only a genuinely different value (switching songs) does.
  const loadedValueRef = useRef<string | null>(null);

  const srcDoc = useMemo(() => {
    const html = buildEditorHtml(colors, placeholder);
    return html.replace("<head>", `<head>${buildPrelude(channel)}`);
  }, [colors, placeholder, channel]);

  function send(message: EditorCommand) {
    iframeRef.current?.contentWindow?.postMessage({ channel, ...message }, "*");
  }

  // A layout effect, so it runs inside the commit that changed `value` and
  // can never be left pending behind a newer message from the editor. As a
  // plain effect it could run late - for value "f" after the editor had
  // already sent "fi" - see "f" !== "fi" as an external change, and
  // re-inject the stale text over what was just typed, throwing the caret
  // back to the start (found by typing fast in a real browser).
  useLayoutEffect(() => {
    if (readyCount === 0) return;
    if (value === loadedValueRef.current) return;
    loadedValueRef.current = value;
    iframeRef.current?.contentWindow?.postMessage(
      { channel, command: "setContent", html: sanitizeLyricsHtml(value) },
      "*",
    );
  }, [readyCount, value, channel]);

  useImperativeHandle(ref, () => ({
    applyColor(span) {
      send({
        command: "applyColor",
        color: span.color ?? "",
        background: span.background ?? "",
      });
    },
    clearColor() {
      send({ command: "clearColor" });
    },
  }));

  // Kept in a ref so the window listener below is attached once, but always
  // calls the latest props.
  const handlersRef = useRef({ onChangeText, onSelectionChange });
  useLayoutEffect(() => {
    handlersRef.current = { onChangeText, onSelectionChange };
  });

  // A layout effect, not a plain effect: it runs in the same task that
  // inserts the iframe, so it's guaranteed to be listening before the
  // iframe's document can load and post "ready". A plain effect can run
  // after that - the "ready" is then lost and the content never injected,
  // which showed up as an empty editor after reloading a song's page.
  useLayoutEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const envelope = event.data as { channel?: string; data?: unknown };
      if (envelope?.channel !== channel || typeof envelope.data !== "string")
        return;

      let message: { type?: string; payload?: unknown };
      try {
        message = JSON.parse(envelope.data);
      } catch {
        return;
      }
      if (message.type === "ready") {
        loadedValueRef.current = null;
        setReadyCount((count) => count + 1);
      } else if (
        message.type === "change" &&
        typeof message.payload === "string"
      ) {
        loadedValueRef.current = message.payload;
        handlersRef.current.onChangeText(message.payload);
      } else if (message.type === "selection") {
        const payload = message.payload as
          { hasSelection?: boolean; span?: ColorSpan | null } | undefined;
        handlersRef.current.onSelectionChange(
          Boolean(payload?.hasSelection),
          payload?.span ?? null,
        );
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [channel]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        title={placeholder}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
        }}
      />
    </View>
  );
});

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
  });
}
