<img src="logo.svg" width="80" height="80" alt="Cinema light symbol">

# Movies — Jellyfin Tizen Mini

A small, movies-first Jellyfin client for an older Samsung TV. Open the app, choose a film, watch. Built with plain HTML, CSS and ES5 JavaScript, with no bundled runtime dependencies or web fonts.

The source and original logo are available under the [MIT license](LICENSE).

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

The app files are at the repository root. No package-manager dependencies are required. Use Node.js 24, Python 3.9 or later, and Chrome or Chromium for the browser regression.

```sh
node tests/core.cjs
node --check app.js
node --check core.js
python3 tests/browser.py
python3 tools/package.py
```

The browser regression loads the actual app HTML and JavaScript with synthetic Jellyfin/player adapters. It covers the observed paused-seek bug (no native time event), captions/progress after seeking, serialized player calls, Return during a seek and bookmark replay. It uses a temporary browser profile and no real account, film or TV. Chrome tests do not replace hardware playback checks. These checks and unsigned packaging also run in GitHub Actions.

The packager creates **an unsigned widget**, `dist/Movies.unsigned.wgt`, containing seven runtime assets and the MIT notice. Tests and documentation are excluded. Signing tools, certificates, credentials and installed binaries are kept outside this repository.

### Code layout

- `core.js`: pure subtitle parsing/selection and the legacy playback profile, exposed through the small `MiniCore` interface shared by the app and tests.
- `app.js`: login, remote navigation and native playback lifecycle in one closure. Keeping the asynchronous seek rules here avoids spreading their ordering constraints across callers.
- `index.html` and `style.css`: the TV interface. `tests/` exercises the existing `MiniCore`, browser, network and native-player seams without a production dependency-injection layer.

This split is sized for the tested one-TV, 22-film scope. Add a module only when a concrete change benefits from a new seam; preserve ES5 syntax in the shipped scripts. Modern JavaScript in tests never enters the widget. Playback changes need a muted hardware check as well as the regressions.

`logo.svg` is the original vector master. The committed `icon.png` is its 117×117 rendering for the TV launcher. To regenerate it with librsvg:

```sh
rsvg-convert -w 117 -h 117 -o icon.png logo.svg
```

## Installation and startup

You need Tizen Studio with the Samsung TV extension, a signing profile accepted by your TV, Developer Mode, and a network connection between TV and computer. Configure these using Samsung's [certificate guide](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html) and [device testing instructions](https://developer.samsung.com/smarttv/develop/faq/application-testing.html). This repository does not provide certificates or a rooting procedure. Current certificate provisioning has not been verified across other 2015 TVs.

Build the unsigned widget as above, then extract it into a clean directory. Package that directory with your own profile, install the resulting signed `.wgt`, and launch the application. The following follows Samsung's [CLI workflow](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html); replace the uppercase placeholders with your profile, device serial and generated package filename:

```sh
python3 -m zipfile -e dist/Movies.unsigned.wgt dist/signing
tizen build-web -- dist/signing
tizen package -t wgt -s YOUR_PROFILE -- dist/signing/.buildResult
sdb devices
tizen install -s YOUR_DEVICE_SERIAL -n YOUR_SIGNED_PACKAGE.wgt -- dist/signing/.buildResult
tizen run -s YOUR_DEVICE_SERIAL -p HomeCinema.player
```

The portable packager and app are tested here; this generic SDK installation sequence has not been rerun on the rooted test TV. Installation persistence and certificate acceptance depend on the TV/firmware. Keep the `LICENSE` file when repackaging.

Movies retains the original `HomeCinema.player` application ID, `HomeCinema` package and `home-cinema-*` storage keys so updates preserve existing installations. The first branded update discovers the previous server from the single saved token-key name, then remembers it explicitly. A new installation starts with an empty server field.

On November 10, the owner left the TV untouched after remote off/on and confirmed that the app opened automatically at about **15 seconds**. An earlier off/on attempt was reported as a failure and followed by a manual launch; its wait duration was not recorded. This is one confirmed unattended wake, not a guarantee for every cycle or other TV models.

The tested TV's native startup preference was configured separately using root access. It stores the app's display name, which must match `Movies` after renaming. This repository does not apply that device-specific adjustment; installing the widget alone does not configure autostart. The client does not install a boot service or replace Samsung's system shell. The physical Menu button still opens TV settings.

## Privacy and recovery

This repository contains app source, original branding, synthetic subtitle tests and an unsigned packager. It contains no server address, movie catalogue, film artwork, saved account, signing certificate or private key. The installed app stores its Jellyfin access token in localStorage; treat a TV data backup as private.

Source control does not back up signing keys or TV account data. Preserve the original signing credentials separately if you need to update an existing installation under the same application identity.

Samsung's web APIs are supplied by the TV; Jellyfin supplies media and metadata at runtime. No third-party runtime library, SDK files or film artwork are bundled. The MIT license covers this repository's source and original logo, not those external platforms or the user's media.
