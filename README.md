# Segue List

[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/campos20)

[![CI](https://img.shields.io/github/actions/workflow/status/campos20/segue-list/ci.yaml?branch=main&label=CI)](https://github.com/campos20/segue-list/actions/workflows/ci.yaml)
[![Release](https://img.shields.io/github/v/release/campos20/segue-list?include_prereleases&sort=semver&label=release)](https://github.com/campos20/segue-list/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android-lightgrey)](#running-the-app)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)

<!-- The CI and release badges read live GitHub state, so until the first
     workflow run and the first tagged release they read "no status" and "no
     releases found". Both fill themselves in - nothing to change here. -->

**Try it in your browser: <https://campos20.github.io/segue-list/>** - no
install needed. See [Web version](#web-version) for how it differs from the
phone app.

> Download this app from Google Play: <https://play.google.com/store/apps/details?id=com.github.campos20.seguelist>.

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
- **ChordPro, both ways.** [ChordPro](https://www.chordpro.org/) is the
  format most chord apps (OnSong, SongbookPro, Planning Center, OpenLP...)
  read and write: chords inline in the lyric, `A[G]mazing [G7]grace`.
  Import is automatic - **Import lyrics files** takes `.cho`/`.chordpro`/
  `.crd`/`.pro` files, recognizes ChordPro inside a `.txt`, `.docx` or
  `.pdf` too, and **Paste chords** recognizes a pasted ChordPro chart;
  songs come in with their chords, title, duration and transposition, and
  a file with several songs (`{new_song}`) becomes several songs. Export a
  song, a setlist or the whole library with **Export as ChordPro** (chords
  written at the pitch you play them). The app has no song sections, key or
  lyric colors in ChordPro terms, so those don't carry over (see
  `src/ui/chordPro.ts`).
- **English and Portuguese**, following the device's language by default,
  overridable in Settings.
- **Light and dark themes**, following the device's setting by default (or
  pick one in Settings) - defaults to dark for anyone updating from before
  this existed, so the app never changes look out from under you.

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
  no sync; the filesystem is the source of truth, read once at launch. The
  web version keeps the same records in the browser's `localStorage`
  instead (`*.web.ts` files next to each storage module - see
  [Web version](#web-version)).
- **i18n**: `src/i18n/` - a plain object dictionary per locale, checked
  against a shared TypeScript type so a missing translation is a compile
  error. See [`AGENTS.md`](AGENTS.md) for why this project has no backend and
  the invariants that keeps in place.

## Backup and sharing

Exporting (from the Library's overflow menu, or a single setlist's) writes a
`.seguelist` file - plain JSON, not a proprietary binary format, so it stays
readable even by hand. It contains the songs and setlists you exported, and
nothing else - no account data, because there isn't any.

Importing reads that file back in. Anything new is added. A song or setlist
whose id already exists locally is left untouched when your copy is the same
age or newer, so re-importing your own backup is a no-op instead of silently
overwriting something you've since edited. When the file's copy was saved
more recently - you edited the song on the web version, say - the app asks
before replacing yours, and nothing is replaced unless you confirm.

## Web version

The app also runs in a browser at <https://campos20.github.io/segue-list/>,
meant for comfortable editing at a keyboard: write or fix lyrics there,
then **Export full library** and **Import backup** on the phone to bring the
changes over (newer copies replace older ones after you confirm). It also
works on its own, saving everything in that browser.

- **Where your data lives**: only in that browser's local storage - no
  account, no server. Clearing the site's data deletes it, and Safari
  removes it after about a week without a visit, so keep a backup export.
- **Use the phone on stage.** The web version is for editing; the phone
  app is what's built for a live show.
- **One tab at a time.** If the library changes in another tab, the page
  stops saving and asks you to reload, rather than overwriting the other
  tab's newer edits with an older copy.

It's published to GitHub Pages by `.github/workflows/pages.yaml`, always
from the latest release tag (so it never gets ahead of the phone app), next
to the [privacy policy](https://campos20.github.io/segue-list/privacy-policy-en.html).
To try it locally: `npm run web`. To reproduce the Pages build:

```bash
EXPO_BASE_URL=/segue-list npx expo export --platform web
```

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

## Testing

```bash
npm test              # watch mode
npm run test:coverage # single run with a coverage summary
```

Coverage is unit tests over the pure logic and Redux thunks in `src/store/`
and `src/ui/`'s top-level files (`reorder.ts`, `libraryTree.ts`, ...) - not
`ui/components/`, `ui/screens/`, or `app/` (see [Stability over
appearance](AGENTS.md) for why UI correctness here leans on manual device
testing instead). CI posts the current numbers as a comment on every pull
request into `main`, so there's nothing here to regenerate or keep in sync.

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

## Sponsor

[![Sponsor via GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-%E2%9D%A4-ea4aaa?logo=githubsponsors&logoColor=white&style=for-the-badge)](https://github.com/sponsors/campos20)

Segue List is free and GPL-licensed, and it stays that way. If it earns its
place on your stage, sponsorship helps in one concrete way right now: an
**Apple Developer Program membership ($99/year)**. Right now this only ships
as a sideloaded Android APK - that membership is what unlocks a real iOS
release, the same way it does for this project's sibling app,
[Virtual VS](https://github.com/campos20/virtual-vs).

You can also sponsor from the **Sponsor** button at the top of the
[repository page](https://github.com/campos20/segue-list).

Not in a position to sponsor? Reporting a bug from a real gig is worth a lot
too - the fixes in this project all came from someone actually using it.

## License

[GPL-3.0-or-later](LICENSE).
