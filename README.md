# ChatGPT Avatars Chrome Extension

This repository is structured as a Chrome extension (Manifest V3).

## Files

- `manifest.json` – extension manifest and content script registration.
- `content.js` – avatar injection + image cropper logic.
- `content.css` – avatar and cropper styling.
- `_locales/en/messages.json` – default English UI strings.
- `_locales/es/messages.json` – Spanish UI strings.

## Supported site

- `https://chatgpt.com/*`


## Icon sync policy

- `ico/*.png` is intentionally gitignored so icon artwork stays local and will not be synced by default.
- Keep your production icons in `ico/` locally when packaging/publishing.

## Load in Chrome (Developer Mode)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

Then visit ChatGPT and click an avatar bubble to upload/crop.
