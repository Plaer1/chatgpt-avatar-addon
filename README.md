# ChatGPT Avatars Chrome Extension

This repository is now structured as a Chrome extension (Manifest V3).

## Files

- `manifest.json` – extension manifest and content script registration.
- `content.js` – avatar injection + image cropper logic.
- `content.css` – avatar and cropper styling.
- `SOURCES.md` – third-party attribution and implementation provenance.

## Load in Chrome (Developer Mode)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

Then visit ChatGPT and click an avatar bubble to upload/crop.
