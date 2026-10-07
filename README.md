# Folio

Folio reads text out of images and PDFs in the browser. The file stays in this browser.

**Live site:** [aditano.github.io/folio](https://aditano.github.io/folio/)

## Features

- Drop a file, choose one, or paste it from the clipboard
- PNG, JPEG, WebP, GIF, BMP, and PDF (up to 20 MB; the first 25 PDF pages)
- On-device OCR with Tesseract, in 17 languages
- The language choice is remembered in the browser
- Page preview and thumbnails for multi-page PDFs
- Edit the recognized text, copy the current page, or download the document as `.txt`
- Stop a read, start a new file, or read the same file again in another language

## Run locally

Node.js 22 is required.

```bash
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

`npm run build:pages` writes the static site to `pages-dist/`. A push to `main` deploys that folder to GitHub Pages.

## Tech stack

- React 19 and TypeScript
- Vite 8 with TanStack Start and TanStack Router
- Tailwind CSS 4
- Tesseract.js for OCR
- PDF.js (`pdfjs-dist`) for PDF rendering
- GitHub Actions publishes the static build to GitHub Pages

## License

Copyright (C) 2026 Anthony DiTano.

Folio is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. The full text is in [LICENSE](LICENSE).

Third-party assets and code keep their own licenses. They are exceptions:

- `public/__grok/` (install-page styles and icons, including the Grok logo) stays under its own terms.
- npm dependencies stay under the licenses recorded in `package-lock.json`. Tesseract.js and the Tesseract OCR traineddata it downloads are Apache License 2.0. PDF.js (`pdfjs-dist`) is Apache License 2.0.
