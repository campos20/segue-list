# Segue List

A setlist app for musicians: write your songs' lyrics once, group them into
setlists, and read them on a phone or tablet during a show. No account, no
backend - everything lives on your device, and you back it up or hand it to
another musician by exporting a file.

## The name

A _segue_ is a smooth transition straight into the next song - no gap, no
fumbling for a lyrics sheet. That's what Presentation mode is: tap through a
setlist mid-set with the next song's lyrics one tap away.

## Features

- **Songs and setlists.** A song is just a name and its lyrics. It can sit
  loose in your library or belong to any number of setlists - the same song
  can be in Sunday's setlist and Friday's without being copied.
- **Presentation mode.** A fullscreen, high-contrast lyrics view for reading
  on stage: adjustable text size, an optional all-caps mode, auto-scroll at
  three speeds, a jump list to switch songs instantly, and the screen is kept
  from locking for as long as you're in it.
- **Search.** Find a song or a setlist by name, from anywhere in your
  library, even one buried inside a collapsed setlist.
- **Local-only storage.** Every song and setlist is a plain JSON file on your
  device (see [Storage](#storage) below) - no server, no login, works with
  the phone in airplane mode.
- **Backup and sharing.** Export your whole library, or just one setlist, as
  a single file and hand it off through the OS share sheet - Drive, AirDrop,
  email, whatever. Importing merges it into your library without touching
  anything you already have.
- **English and Portuguese**, following the device's language by default,
  overridable in About.

## Architecture

- **State**: [Redux Toolkit](https://redux-toolkit.js.org/), one entity
  adapter each for songs and setlists (`src/store/`). A write always goes to
  disk first and only updates the store if that succeeded - the file is the
  record, so the store must never claim a change that isn't actually saved
  (see `store/persistSongs.ts` / `store/persistSetlists.ts`).
- **Storage**: [`expo-file-system`](https://docs.expo.dev/versions/latest/sdk/filesystem/)
  (`src/storage/`). Each song and each setlist is its own
  `<id>.json` file under the app's document directory - a setlist's file
  holds song _ids_, not the songs themselves, which is what lets one song
  belong to several setlists without duplication. There is no database and
  no sync; the filesystem is the source of truth, read once at launch.
- **i18n**: `src/i18n/` - a plain object dictionary per locale, checked
  against a shared TypeScript type so a missing translation is a compile
  error. See [`AGENTS.md`](AGENTS.md) for why this project has no backend and
  the invariants that keeps in place.

## Backup and sharing

Exporting (from the Library's overflow menu, or a single setlist's) writes a
`.seguelist` file - plain JSON, not a proprietary binary format, so it stays
readable even by hand. It contains the songs and setlists you exported, and
nothing else - no account data, because there isn't any.

Importing reads that file back in. A song or setlist whose id already exists
locally is left untouched, so re-importing your own backup is a no-op instead
of silently overwriting something you've since edited, and a file from
another musician can never clobber one of yours that happens to share an id.

## Running the app

Every native module this app uses (`expo-file-system`, `expo-sharing`,
`expo-document-picker`, `expo-localization`, `expo-keep-awake`) ships in
**Expo Go** - no custom dev client build needed.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press
`i` / `a` in the terminal for a simulator/emulator. The Library starts empty:
tap **New song** to write your first lyrics, or **New setlist** to start
grouping songs for a show.

## Downloading a release

Tagged releases publish a signed APK to the
[Releases page](https://github.com/campos20/segue-list/releases). Download
the `.apk` and open it on your Android device.

### Verifying a download

**1. Confirm GitHub built it, from this repo, at that commit:**

```bash
gh attestation verify segue-list-<version>.apk --repo campos20/segue-list
```

This checks a signed [provenance attestation](https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
recorded in a public transparency log when the release workflow ran. If the
APK was modified or built anywhere else, this fails - it's the check that
matters most, and it covers the other two.

**2. Confirm the file wasn't altered after upload:**

```bash
sha256sum -c SHA256SUMS.txt
```

**3. Confirm the signing certificate**, printed in every release's notes:

```bash
apksigner verify --print-certs segue-list-<version>.apk
```

Releases are cut by pushing a `v*` tag, or via the "Release Android APK"
workflow's manual dispatch - see
[`.github/workflows/release.yaml`](.github/workflows/release.yaml).

## Building a release APK (Android)

There's no EAS Build config here - releases build locally with the same
native Android toolchain `expo run:android` uses under the hood:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

`android/` is gitignored and regenerated on demand, not committed. The APK
lands at `android/app/build/outputs/apk/release/app-release.apk`. A local
build like this signs with Expo's stock debug keystore - fine for your own
devices, not for handing out. Published releases are signed with the
project's real release key via
[`plugins/withAndroidSigning.js`](plugins/withAndroidSigning.js), which only
activates when the signing secrets are configured in the repo (see
[`.github/workflows/release.yaml`](.github/workflows/release.yaml)).

## License

[GPL-3.0-or-later](LICENSE).
