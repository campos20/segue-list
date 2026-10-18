# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Stability over appearance

This app runs live, on stage, during a performance. Someone reading lyrics
off it mid-song has no "reload the page" - a crash, a frozen screen, or a
setlist that silently didn't save is a real problem in a way a plain UI bug
in most apps isn't. Stability, correctness, and predictability always
outrank visual polish or how modern something looks.

Concretely:

- **Reordering uses explicit move-up/move-down buttons, not a drag
  gesture.** A hand-rolled drag (`PanResponder` or gesture-handler inside a
  `ScrollView`, negotiating touch-responder priority against a sibling
  `Pressable`) has gesture-arbitration edge cases that are hard to fully
  verify without a real device. Two ordinary buttons, each swapping a row
  with its neighbor, are fully deterministic. See `ui/components/MoveColumn.tsx`.
- **A `Pressable` that triggers navigation gets its press feedback from the
  `style` callback, never from a function-as-child (`{({ pressed }) => ...}`).**
  This project hasn't hit it, but a sibling app in active development
  (virtual-vs) traced a hard-to-reproduce native crash to exactly this
  pattern: a function child re-creates its elements on every press-state
  change, and releasing the button can do that in the same frame a
  navigation call is tearing the screen's native views down. Every
  `Pressable` in this codebase keeps its children structurally constant and
  puts `pressed &&` styling in the `style` prop instead - keep doing that in
  anything new.
- **Before adding a runtime dependency, weigh whether it's well-established
  for the job, not just convenient.** This app deliberately stays on
  Expo-managed modules that ship in Expo Go (`expo-file-system`,
  `expo-sharing`, `expo-document-picker`, `expo-localization`,
  `expo-keep-awake`) - no custom native modules, no dev-client build
  required, no dependency that would need its own prebuild step to try out.
  Don't add one "for later"; an installed-but-unused dependency still ships
  in the build and adds untested surface area.
- **A storage write always lands on disk before the store hears about it,
  and the store only updates if that write succeeded.** Every function in
  `store/persistSongs.ts` and `store/persistSetlists.ts` follows this same
  shape: write the file, and only on success dispatch the action that makes
  the UI believe it. The manifest on disk is the record; the Redux store is
  a cache of it, never the other way around. A song someone edited mid-set
  must not appear saved in the UI if the write actually failed.
- **Presentation mode has no switcher of its own for rich-text vs.
  lyrics+chords - it always displays whatever `settings.lyricsViewMode` is
  currently set to.** That single global setting (`store/settingsSlice.ts`)
  is shared with `SongDetailScreen`'s "Rich text"/"Chords" editing tabs,
  which are what actually change it (`persistLyricsViewMode`); Presentation
  only reads it. This was tried the other way once - a separate Lyrics/Chords
  toggle inside Presentation mode's own header/panel - and reverted: on
  stage, screen space belongs to the lyrics and chords themselves, not to a
  second copy of a mode switcher, and showing whatever you were last editing
  is exactly what you want to present anyway. Don't reintroduce a
  Presentation-only view-mode control; if the display is showing the wrong
  thing, the fix is in how `lyricsViewMode` is set from the editor, not a new
  toggle in `PresentationScreen.tsx`.

## The web version

The app also ships as a web build on GitHub Pages - for editing lyrics at a
keyboard and moving them to the phone through a backup file, or for using on
its own. The phone is still what the app is _for_: the web version must never
make the iOS/Android app any less stable. That's enforced structurally, not by
being careful:

- **Everything web-only lives in a `*.web.ts`/`*.web.tsx` file** next to the
  native module it replaces, with the same exports: `storage/songLibrary`,
  `setlistLibrary`, `appSettings`, `share`, `pickedFile`, `ui/dialogs`,
  `ui/components/LyricsRichEditor`, `ui/components/WebLibraryBanner`,
  `ui/components/SendToPhoneButton`, `ui/components/OpenInAppLink`,
  `ui/importPayload`. Metro
  picks one file per platform, so web code is never in a phone bundle. Never
  add a `Platform.OS === "web"` branch to a shared file instead - that ships
  the web path to phones. `storage/browserStorage.ts` has no `.web` suffix
  but is only ever imported from `.web` files; keep it that way.
- **CI proves it**: `ci.yaml` exports the Android bundle and fails if it
  contains strings that exist only in web files (`segue-list:v1:`,
  browserStorage's error text, the editor's `allow-scripts`, the QR code's
  test id and the web-only `qrcode-generator` library's own error text). If
  you rename one of those, update the marker list.
- **Shared code stays platform-neutral**: `bundle.ts` and `docxExport.ts`
  build text/bytes; only `share.ts` / `share.web.ts` deliver them.
  `lyricsImport.ts` reads through the small `ReadableFile` interface, which
  expo-file-system's `File` already satisfies - the phone passes the same
  object it always did.
- **A shared-code change still needs a phone check.** Don't assume a fix
  verified only on web is verified at all; confirm on iOS/Android (or at
  minimum a real `expo export`/`expo prebuild` for that platform) before
  calling something done.

Web storage is `localStorage` (`storage/browserStorage.ts`), not IndexedDB,
on purpose: it's synchronous like the rest of the storage API, so the "write
lands before the store hears about it" contract holds unchanged - a full
browser storage throws, and the persist thunks never dispatch. Keys are
prefixed `segue-list:v1:` because every project page on `campos20.github.io`
shares one origin. Two guards stop a stale tab from overwriting a newer
edit made in another tab. First, every write checks that its key still holds
what this tab last read or wrote; if not, it's refused on the spot. The
`storage` event alone can't do this, because it arrives asynchronously, after
a near-simultaneous save could already have overwritten the other tab's edit.
Second, once another tab is known to have written (by that check or by the
`storage` event), this tab's store may be stale everywhere, so browserStorage
refuses every further write and WebLibraryBanner asks for a reload. A refused
write is just another failed write to the code above it.

`Alert.alert` is a documented no-op in `react-native-web` (`static alert()
{}`), so never call it directly: use `ui/dialogs.ts`'s `confirmDestructive` /
`showMessage`, which are `Alert.alert` on phones and `window.confirm` /
`window.alert` on web. Before this existed, every delete and "Discard
changes?" silently did nothing on web.

The rich-text editor on web hosts the exact same `buildEditorHtml` document
in an `<iframe srcdoc sandbox="allow-scripts">` (opaque origin - it can't
reach the page or its localStorage). The iframe's "ready" can arrive before
a plain `useEffect` listener is attached (an empty editor after reloading a
song's page), so `LyricsRichEditor.web.tsx` listens from a layout effect.

Deploys (`.github/workflows/pages.yaml`) always build the app from the
**latest release tag**, never from main - a web build ahead of the released
phone app could write a backup format the phone can't read yet. `docs/` (the
privacy policy, linked from the Play Store) is taken from main and copied in
with a collision check, so those URLs never move. The export is a
single-page app (`web.output: "single"`) with `404.html` as a copy of the
shell, because Pages can't route `/song/<id>` itself; the `/segue-list`
subpath comes from `EXPO_BASE_URL` via `app.config.js`, so `npm run web`
still serves from the root.

## A documented incident: the caret jumping while typing in `LyricsRichEditor`

A user reported the cursor jumping while typing in Rich text mode. Both
editors (`LyricsRichEditor.tsx` and its `.web.tsx` twin) decide whether
`value` is an external change - switching songs, a save that trims - by
comparing it against the last content the editor itself reported, and
re-inject it with `__setContent` if not. That comparison ran in a plain
`useEffect`, which React may run _after_ the editor has already posted a
newer keystroke: the effect for render "f" ran once "fi" had arrived, saw
"f" !== "fi", and re-injected "f" - rewriting the editor's content, losing
the keystroke and throwing the caret to the start. On every keystroke, when
typing quickly. It was first found on web by driving the editor with fast
real keyboard input in Chromium, then reproduced for the phone component in
`LyricsRichEditor.native.test.tsx` (real React scheduling, not `act()` -
React yields to paint between a commit and its passive effects, which is
the window the next keystroke lands in). Fix: the comparison runs in a
`useLayoutEffect`, inside the commit itself, so it can never be left
pending behind a newer message. Keep it a layout effect.

The same test file covers a second bug found alongside it: new theme colors
rebuild the editor's HTML, and Android's WebView reloads the page whenever
it gets a new `source` - but the component only tracked "ready" as a boolean,
so the reloaded (empty) page never got its content back. Reachable from the
song screen itself (Color -> theme link -> change theme -> back), and typing
into that blank editor would have replaced the song's lyrics with only the
new text. Fix: count "ready" messages and forget what was loaded on each
one, so every fresh page gets the content injected.

## Syncing a draft from a loaded entity

`SongDetailScreen` needs local editable state that starts from a Redux
entity but shouldn't reset on every store update - only when the song you're
looking at actually changes (or first becomes available, since hydration can
land after the screen has already mounted). The same need will come up again
anywhere else a screen edits one entity loaded by id. The naive `useEffect`
version of this
(`useEffect(() => setState(entity.field), [entity?.id])`) trips
`react-hooks/set-state-in-effect` and, more importantly, costs an extra
render. Instead, adjust the state during render itself, guarded by a
"last synced id" value in state:

```ts
const [syncedId, setSyncedId] = useState<string | undefined>(undefined);
if (entity && entity.id !== syncedId) {
  setSyncedId(entity.id);
  setDraftField(entity.field);
}
```

This is a deliberate, React-endorsed pattern ("adjusting state when a prop
changes"), not a shortcut - keep using it for the same problem rather than
reaching for `useEffect`.

## A documented incident: `expo-keep-awake` on web

Presentation mode calls `useKeepAwake()` so the screen can't lock mid-song.
On web, activating a wake lock is asynchronous (`navigator.wakeLock.request`),
and the hook's cleanup deactivates on unmount unconditionally. Exiting
Presentation mode quickly - fast enough that the activation promise hadn't
resolved yet - threw an uncaught `ERR_KEEP_AWAKE_TAG_INVALID` from the
cleanup, which surfaced as Metro's dev error overlay blocking the whole page.
Fixed by passing `{ suppressDeactivateWarnings: true }`, which the library
provides for exactly this race (it catches instead of throwing). If you touch
`useKeepAwake` again: this only reproduces on a fast mount → unmount, so
exercise that path (enter and immediately exit) before trusting a change.

## A documented incident: blank lines doubling in `LyricsRichEditor`

A user reported that Presentation mode's rich-text view sometimes showed more
blank lines than they'd typed - going back into the editor, deleting the
extra line, and saving fixed it. Root cause: `LyricsRichEditor.tsx`'s
`serialize()` walks the `contenteditable` DOM and turns every `<div>`
boundary into `"\n"` (Enter is deliberately left to the browser's own
default handling - see the comment above `editor.addEventListener("input", ...)`

- which wraps each line in its own `<div>`). Chrome/WebKit represent a truly
  _empty_ line as `<div><br></div>` - a lone `<br>` inserted only so the
  otherwise-content-less `<div>` doesn't collapse to zero height. The old
  `serialize()` counted that the same as any other `<br>`, so an empty line
  produced **two** `"\n"` (one for the div boundary, one for the inner `<br>`)
  instead of one - every blank line the user pressed Enter-Enter for silently
  became two blank lines in what got saved, invisible in the editor itself
  (which just shows one blank line's worth of height either way) but visible
  once Presentation mode rendered the stored text as literal line breaks.
  First fix: skip a `<br>` that is its parent `<div>`'s _only_ child (a real
  Shift+Enter soft break sitting alongside other text in the same `<div>`
  still counts normally), tracked with a `blockCount` instead of checking
  `out.length > 0` for a `<div>`'s own leading separator - a blank first
  `<div>` contributes nothing to `out`, so `out.length` alone can't tell "no
  line yet" from "one blank line so far".

That fix shipped a regression, caught by a second bug report on the very
same feature: editing existing (already-loaded) lyrics started _merging_
two lines together instead of separating them - e.g. inserting one new line
between two existing ones made it stick to whichever line followed it.
Root cause: content loaded via `__setContent` is flat (`__setContent`
converts the stored `"\n"`s straight into `<br>` siblings, no `<div>`
wrapping at all), and Chrome only wraps lines in `<div>` from the point
where Enter is actually pressed onward - confirmed by hand (place the caret
partway through flat multi-line content, type, press Enter once: everything
after the caret becomes one new `<div>`, everything before stays flat as
plain text/`<br>` siblings). So a single document routinely mixes flat
top-level content with `<div>`-wrapped top-level content. `blockCount` only
counted previous `<div>`s, so the first `<div>` immediately following flat
content had no idea a line already preceded it and dropped its leading
separator, gluing that div's content onto the end of the preceding flat
text. Fixed by replacing `blockCount` with a boolean,
`hasEmittedTopLevelLine`, set after processing _any_ top-level child (flat
text/`<br>`, not just a `<div>`) - only a `<div>`/`<p>` boundary reads it, to
decide whether it needs a leading `"\n"`.

The lesson from getting this wrong once already: don't hand-guess DOM
shapes for this function - drive the _real_ embedded HTML/JS with actual
keyboard input in a real Chromium engine (`buildEditorHtml` renders as a
loadable static HTML file; open it with Playwright, mock
`window.ReactNativeWebView.postMessage` to capture `serialize()`'s output,
and use real `page.keyboard.type`/`press("Enter")` after placing the caret
via `Range`/`Selection` - not JS-constructed HTML strings, which is exactly
what produced a plausible-looking but wrong test suite the first time).
`src/ui/components/LyricsRichEditor.test.ts` now encodes several DOM shapes
taken verbatim from that kind of repro, including the flat-content-then-
`<div>` shape that broke here and a `<div>` whose content starts with its
own leading `<br>`s (packing more than one visual line inside a single
`<div>`) - both real Chrome output, not invented. The tests drive the exact
embedded HTML/JS through jsdom (`runScripts: "dangerously"`) rather than a
reimplementation, so they exercise the real production string; the file's
own `buildEditorHtml` export exists specifically so it can be loaded
outside a device this way.

This bug (both times) only ever affected Rich text mode's WebView editor -
Chords mode's lyrics field is a plain `TextInput` with no DOM to
misrepresent line breaks in - but a line count that quietly drifts either
way still matters there: chords are paired with lyrics strictly by line
index (`ui/chords.ts`'s
`pairChordsWithLyrics`/`alignChordsAndLyricsRows`), so a phantom blank
line inflating (or a manual fix deflating) the lyrics line count shifts
which chord line pairs with which lyric line for any song that already has
chords saved. There's no general fix for that beyond fixing the root cause
here - at save time `alignChordsAndLyricsRows` pads the two fields to the
same row count and drops only rows that are blank on _both_ sides (never a
chord-only row, and never by trimming the lyrics alone, which would shift
every lyric against its chords), it just can't know which specific line
moved.
