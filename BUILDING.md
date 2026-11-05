# Build Dokusho for iOS

## Requirements

- macOS with Xcode
- Node.js 20 or later and npm
- An Apple signing team to install on a physical iPhone or iPad

## Build

1. Run `npm install` from the repository root.
2. Open `ios/Dokusho.xcodeproj` in Xcode.
3. Select the **Dokusho** scheme, select a simulator or connected iOS device, and set the signing team for both targets if prompted.
4. Run the app. Xcode builds the Safari Web Extension and embeds it in Dokusho.
5. On iOS, enable Dokusho under **Settings > Apps > Safari > Extensions**, or in Safari under **More > Extensions**.

The extension target runs `npm run build` before packaging its Safari resources. Imported dictionaries are not part of the build: users select their own Yomitan-compatible ZIP files in the extension's **Từ điển** page.

## Dictionary import scope

The importer expects a ZIP containing `index.json` and one or more `term_bank_*.json` or `kanji_bank_*.json` files. It stores the supported term and Kanji entries in the Safari extension's local IndexedDB database. Large archives should be checked on a physical device because iOS storage and memory limits depend on the device and Safari version.
