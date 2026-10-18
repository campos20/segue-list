import { useLayoutEffect, useState } from "react";
import { Provider } from "react-redux";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createAppStore } from "@/store";
import { themeOverrideSet } from "@/store/settingsSlice";
import { LyricsRichEditor } from "./LyricsRichEditor";

/**
 * The phone's LyricsRichEditor, with react-native-webview swapped for a
 * stand-in that records what the component injects and lets the test play
 * the editor page's side of the bridge (posting "ready"/"change" messages).
 * Covers two bugs in deciding when to inject content into the editor:
 *
 * - A user reported the caret jumping while typing. The "is `value` an
 *   external change?" check ran in a plain useEffect, which React can run
 *   after the editor has already sent a newer message - so the stale
 *   render's value looked external and got re-injected over what was just
 *   typed, resetting the caret. These messages are deliberately sent
 *   outside act(), through React's real scheduler: it yields to paint
 *   between a commit and that commit's passive effects, which is exactly
 *   the window a second keystroke's message lands in on a device.
 * - When the WebView reloaded (new theme colors -> new HTML), the fresh
 *   page posted "ready" again but nothing was re-injected, leaving the
 *   editor blank - and typing there would then replace the song's lyrics
 *   with only the new text.
 */

jest.mock("@/storage/appSettings", () => ({
  readAppSettings: jest.fn(() => ({})),
  writeAppSettings: jest.fn(),
}));

const injected: string[] = [];
let webViewProps: {
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  source: { html: string };
};

jest.mock("react-native-webview", () => {
  const { forwardRef, useImperativeHandle, useLayoutEffect } =
    jest.requireActual("react");
  return {
    WebView: forwardRef(function MockWebView(
      props: typeof webViewProps,
      ref: unknown,
    ) {
      useImperativeHandle(ref, () => ({
        injectJavaScript: (script: string) => injected.push(script),
      }));
      useLayoutEffect(() => {
        webViewProps = props;
      });
      return null;
    }),
  };
});

/** What a test-time host (like SongDetailScreen) currently holds as the lyrics. */
let hostValue = "";

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  useLayoutEffect(() => {
    hostValue = value;
  });
  return (
    <LyricsRichEditor
      value={value}
      onChangeText={setValue}
      onSelectionChange={() => {}}
      placeholder="Lyrics"
    />
  );
}

function post(type: string, payload: unknown = null) {
  webViewProps.onMessage({
    nativeEvent: { data: JSON.stringify({ type, payload }) },
  });
}

/** Every setContent call's argument, in order. */
function setContentCalls(): string[] {
  return injected
    .filter((script) => script.startsWith("window.__setContent("))
    .map((script) =>
      JSON.parse(
        script.slice("window.__setContent(".length, script.indexOf("); true;")),
      ),
    );
}

/** One macrotask: lets React's scheduler run whatever it has queued, up to its next yield. */
function nextTask() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function settle() {
  for (let index = 0; index < 10; index++) await nextTask();
}

function setActEnvironment(enabled: boolean) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = enabled;
}

let renderer: ReactTestRenderer;
let store: ReturnType<typeof createAppStore>;

beforeEach(async () => {
  setActEnvironment(true);
  injected.length = 0;
  store = createAppStore();
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <Host initial="saved lyrics" />
      </Provider>,
    );
  });
});

afterEach(async () => {
  setActEnvironment(true);
  await act(async () => renderer.unmount());
});

it("loads the current lyrics once the editor page is ready", async () => {
  await act(async () => post("ready"));
  expect(setContentCalls()).toEqual(["saved lyrics"]);
});

it("never re-injects while typing, even when a newer keystroke arrives before React's effects run", async () => {
  await act(async () => post("ready"));
  injected.length = 0;

  // Real scheduling from here on, like a device - not act()'s synchronous flushing.
  setActEnvironment(false);
  let typed = "";
  for (const char of "first line") {
    typed += char;
    post("change", typed);
    // One task: React renders and commits this keystroke, then yields to
    // paint - its effects aren't flushed yet when the next keystroke posts.
    await nextTask();
  }
  await settle();

  expect(setContentCalls()).toEqual([]);
  expect(hostValue).toBe("first line");
});

it("still injects a genuinely external change (switching songs)", async () => {
  await act(async () => post("ready"));
  await act(async () => post("change", "typed"));
  injected.length = 0;

  await act(async () => {
    renderer.update(
      <Provider store={store}>
        <Host key="other-song" initial="another song" />
      </Provider>,
    );
  });
  // A different song remounts the editor (key), so it waits for its ready.
  await act(async () => post("ready"));

  expect(setContentCalls()).toEqual(["another song"]);
});

it("re-injects the lyrics when the page reloads after a theme change", async () => {
  await act(async () => post("ready"));
  await act(async () => post("change", "edited, not saved yet"));
  const htmlBefore = webViewProps.source.html;
  injected.length = 0;

  await act(async () => {
    store.dispatch(themeOverrideSet("light"));
  });
  expect(webViewProps.source.html).not.toBe(htmlBefore);
  // The reloaded page starts empty and announces itself again.
  await act(async () => post("ready"));

  expect(setContentCalls()).toEqual(["edited, not saved yet"]);
});
