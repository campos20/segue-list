import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
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
