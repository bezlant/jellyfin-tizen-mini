<img src="logo.svg" width="80" height="80" alt="Cinema light symbol">

# Movies — Jellyfin Tizen Mini

A small, movies-first Jellyfin client for an older Samsung TV. Open the app, choose a film, watch. Built with plain HTML, CSS and ES5 JavaScript, with no bundled runtime dependencies or web fonts.

This repository is currently private. The source and original logo are prepared for release under the [MIT license](LICENSE).

## What it does

- Twelve-poster movie grid with four-way remote navigation.
- Movie artwork, synopsis, resume and subtitle selection.
- Native Samsung AVPlay playback, simple controls and progress reporting to Jellyfin.
- English subtitle selection: full dialogue first, then SDH, then forced-only tracks. Text captions are rendered by the app; supported image captions are burned into the video by Jellyfin.
- Remembers the server and account on the TV. Passwords are not saved.

The client uses Jellyfin's HLS transcoding path with H.264 video and stereo AAC audio. It does not download, generate or repair subtitles; available tracks and any automatic downloads are managed by the server.

## Tested scope

One Samsung UA40J6200, firmware 1550 / Tizen 2.3, with a 22-film Jellyfin library. The TV's browser lacks Promise, fetch, Map, Set and modern flex layout. Keep the shipped JavaScript ES5-compatible and verify changes on the hardware.

Browser previews cannot establish native AVPlay behavior. Other TV models, TV series and larger libraries have not been validated. Playback and artwork use more memory than the initial movie grid; there is no universal memory or boot-time guarantee.

## Development

The app files are at the repository root. No dependency installation is required.

```sh
node tests/core.cjs
node --check app.js
node --check core.js
python3 tools/package.py
```

The packager creates **an unsigned widget**, `dist/Movies.unsigned.wgt`, containing only the seven runtime assets. Sign it with your own Samsung/Tizen signing profile before installation. See Samsung's [TV application configuration](https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html) and [certificate guide](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html). Signing tools, certificates, credentials and installed binaries are deliberately kept outside this repository.

`logo.svg` is the original vector master. The committed `icon.png` is its 117×117 rendering for the TV launcher. To regenerate it with librsvg:

```sh
rsvg-convert -w 117 -h 117 -o icon.png logo.svg
```

## Installation and startup

Movies retains the original `HomeCinema.player` application ID, `HomeCinema` package and `home-cinema-*` storage keys so updates preserve existing installations. The first branded update discovers the previous server from the single saved token-key name, then remembers it explicitly. A new installation starts with an empty server field.

On November 10, the owner left the TV untouched after remote off/on and confirmed that the app opened automatically at about **15 seconds**. An earlier off/on attempt was reported as a failure and followed by a manual launch; its wait duration was not recorded. This is one confirmed unattended wake, not a guarantee for every cycle or other TV models.

The tested TV's native startup setting stores the app's display name, which must match `Movies` after renaming. The client does not install a boot service or replace Samsung's system shell. The physical Menu button still opens TV settings.

## Privacy and recovery

This repository contains app source, original branding, synthetic subtitle tests and an unsigned packager. It contains no server address, movie catalogue, film artwork, saved account, signing certificate or private key. The installed app stores its Jellyfin access token in localStorage; treat a TV data backup as private.

Source control does not back up signing keys or TV account data. Preserve the original signing credentials separately if you need to update an existing installation under the same application identity.

Samsung's web APIs are supplied by the TV; Jellyfin supplies media and metadata at runtime. No third-party runtime library, SDK files or film artwork are bundled. The MIT license covers this repository's source and original logo, not those external platforms or the user's media.
