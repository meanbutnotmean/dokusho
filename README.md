# Dokusho for iOS

Dokusho is an iPhone and iPad Safari reading extension inspired by [Yomikiri](https://github.com/bluegreenmagick/yomikiri). Select Japanese text or tap a word in Safari to see its definition in a small overlay. The main change is support for importing your own external dictionaries.

## Add a dictionary

1. Get a dictionary packaged as a Yomitan-compatible `.zip` file.
2. In Safari, open the Dokusho extension and tap **Từ điển**.
3. Choose the ZIP from Files. Dokusho imports term and Kanji entries and stores them locally on the device.
4. Use the arrows beside installed dictionaries to set lookup priority. Tap **Gỡ** to remove one.

The importer reads `index.json`, `term_bank_*.json`, and `kanji_bank_*.json`. Dictionary files are not bundled with the app; their licenses remain with their authors.

## Build and install on iOS

Building and signing the iOS app requires macOS with Xcode. Windows can edit the source but cannot build or install the iOS app.

1. On a Mac, install Node.js 20 or later.
2. From the project root, run `npm install`.
3. Open `ios/Dokusho.xcodeproj` in Xcode.
4. Select the **Dokusho** app scheme and an iPhone or iPad target, choose your signing team, then run.
5. On the device, enable Dokusho in **Settings > Apps > Safari > Extensions** (or Safari's **More > Extensions** menu).

The extension build phase packages the web extension resources from `dist/safari`; it runs `npm run build` automatically. Xcode on macOS is required for signing and installing the iOS app.

## Features

- Safari extension for iPhone and iPad, with in-page lookup and a manual search popup.
- Import, replace, reorder, and remove Yomitan-compatible dictionary ZIPs.
- Local IndexedDB storage and indexed prefix search.
- Adjustable lookup triggers for text selection, pointer hover, and touch.
- Japanese and Vietnamese interface text.

The repository includes an iOS host app and Safari Web Extension target. Dictionary archives are user-provided and stay on-device.
