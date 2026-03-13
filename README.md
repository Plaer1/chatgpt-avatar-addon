# ChatGPT Avatars Chrome Extension

This repository is structured as a Chrome extension (Manifest V3).

## Files

- `manifest.json` – extension manifest and content script registration.
- `content.js` – avatar injection + image cropper logic.
- `content.css` – avatar and cropper styling.
- `_locales/en/messages.json` – default English UI strings.
- `_locales/es/messages.json` – Spanish UI strings.
- `_locales/ar/messages.json` – Arabic UI strings.
- `_locales/bn/messages.json` – Bengali UI strings.
- `_locales/de/messages.json` – German UI strings.
- `_locales/fr/messages.json` – French UI strings.
- `_locales/hi/messages.json` – Hindi UI strings.
- `_locales/id/messages.json` – Indonesian UI strings.
- `_locales/ja/messages.json` – Japanese UI strings.
- `_locales/mr/messages.json` – Marathi UI strings.
- `_locales/pt_BR/messages.json` – Brazilian Portuguese UI strings.
- `_locales/ru/messages.json` – Russian UI strings.
- `_locales/zh_CN/messages.json` – Simplified Chinese UI strings.

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
