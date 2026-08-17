# Folio

Extract text from images and PDFs in the browser. Files stay on your device.

**Live site:** [aditano.github.io/folio](https://aditano.github.io/folio/)

## Features

- Drop a PNG, JPG, WebP, or PDF
- Paste an image from the clipboard
- On-device OCR with Tesseract (many languages)
- Side-by-side page preview and extracted text
- Copy a page, copy the whole document, or download `.txt`

## Develop

```bash
npm install
npm run dev
```

## GitHub Pages

```bash
npm run build:pages
```

The static site is written to `pages-dist/` and deployed from `main` by GitHub Actions.
