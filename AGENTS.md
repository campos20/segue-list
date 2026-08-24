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

## Known platform limits (web)

`expo-file-system`'s `File`/`Directory` classes have no web implementation -
constructing one on web throws. Every storage function checks
`storage/paths.ts`'s `isFileSystemAvailable` first and no-ops (returning
empty results rather than throwing) when it's false, so running on web
degrades to an empty, non-persistent library instead of crashing at boot.
Web is not a target this app is built for - it exists for quick browser-based
testing during development, not for actual use. Don't assume a fix verified
only on web is verified at all; confirm on iOS/Android (or at minimum a real
`expo export`/`expo prebuild` for that platform) before calling something
done.

Relatedly, `Alert.alert` is a documented no-op in `react-native-web` (see its
source: `static alert() {}`). Every confirmation dialog in this app -
deleting a song or setlist, discarding an unsaved lyrics edit - silently does
nothing on web: the callback never fires, so the safe default is that nothing
happens rather than the destructive action running unconfirmed. This is a
web-only gap, not a bug to chase; the same code shows a real native dialog on
iOS/Android, the platforms this app is actually for.

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
