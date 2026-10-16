# PDF Merger & Toolbox

A fully client-side, offline-capable **PDF Merger & Toolbox Web Application** built with plain HTML, modern CSS, and JavaScript (ES modules). All PDF processing happens securely in the browser using [pdf-lib](https://pdf-lib.js.org/) and [PDF.js](https://mozilla.github.io/pdf.js/) — your files never leave your device.

---

## ✨ Features & Capabilities

### 📑 1. Merge PDF Tool
- **Multi-file upload**: Click to browse or drag-and-drop multiple PDFs at once.
- **Drag-to-reorder & Accessibility**: Rearrange files in any order via SortableJS drag-and-drop or accessible ▲▼ buttons.
- **Quick sorting toolbar**: Sort files alphabetically (A→Z, Z→A), by file size, or reverse order in one click.
- **Page range selection**: Choose specific pages or ranges for each file (e.g., `1-3, 5`, `2-end`) with real-time syntax validation.
- **Document rotation**: Quickly rotate documents by 90°, 180°, or 270° clockwise.
- **Aggregate summary**: Live display of total files, selected pages, and combined file size.
- **Custom output filename**: Define your own download filename (e.g. `quarterly-report.pdf`).
- **In-app preview & download**: Inspect the merged result directly in an embedded viewer before or after downloading.

### 🖼️ 2. Visual Page Organizer
- **Interactive thumbnail grid**: Render crisp visual thumbnails of every page across documents using PDF.js (with canvas placeholder fallback).
- **Page-level reordering**: Drag and drop individual pages to reorder the final document layout.
- **Exclude / delete pages**: Visually toggle pages to include or omit from the merged result.
- **Rotate individual pages**: Rotate sideways or upside-down pages individually.

### ✂️ 3. Split PDF Tool
- **Extract specific ranges**: Extract pages (e.g. `1-3, 5-8`) into a new PDF document.
- **Split into individual pages**: Automatically generate a separate PDF for every page in a document.
- **Split by fixed interval**: Divide documents into chunks of $N$ pages each.

### 🔄 4. Rotate PDF Tool
- **Global document rotation**: Rotate all pages 90° clockwise, 90° counter-clockwise, or flip 180°.
- **Visual page grid**: View page thumbnails and click individual rotation buttons to orient specific pages.
- **Save & download**: Export the newly rotated PDF instantly.

### 📱 5. Offline PWA Support
- **Progressive Web App**: Installable to desktop or mobile with `manifest.webmanifest`.
- **Service Worker**: Cache-first offline strategy via `sw.js` — works without an active internet connection.
- **100% Private**: Zero servers, zero uploads, zero tracking.

---

## 🗂 Project Structure

```
pdf-merger/
├── index.html               # Main application entry point & tool tabs
├── manifest.webmanifest     # PWA manifest
├── sw.js                    # Service worker for offline caching
├── netlify.toml             # Netlify deployment configuration & CSP headers
├── .gitignore
├── README.md
└── src/
    ├── css/
    │   └── styles.css       # Design tokens, layouts, tool panels, dark mode
    ├── icons/
    │   ├── icon-192.png     # PWA icon (192x192)
    │   └── icon-512.png     # PWA icon (512x512)
    └── js/
        ├── main.js              # Application entry point – connects tools & events
        ├── fileManager.js       # In-memory file & page state manager
        ├── pdfTools.js          # PDF operations (merge, split, rotate, page count)
        ├── pdfMerger.js         # Backward-compatible wrapper
        ├── pageRange.js         # Page range syntax parser & validator
        ├── thumbnailRenderer.js # PDF.js thumbnail generation & caching
        ├── ui.js                # DOM rendering, modals, file lists, progress
        └── utils.js             # Utility helpers (formatBytes, sanitiseFilename, uid, ...)
```

---

## 🚀 Local Development

No build step or Node.js environment is required. The app uses native ES modules supported in all modern browsers.

### Option 1 – Python HTTP server (Quickest)

```bash
# Python 3
python3 -m http.server 3000
# Then open http://localhost:3000 in your browser
```

### Option 2 – VS Code Live Server

1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
2. Open the project folder in VS Code.
3. Click **"Go Live"** in the status bar.

### Option 3 – Node.js `serve`

```bash
npx serve .
```

> **Note:** Opening `index.html` directly as a `file://` URL will not work because ES modules require an HTTP origin.

---

## ☁️ Deployment on Netlify

### Netlify UI

1. Push this repository to GitHub.
2. Go to [app.netlify.com](https://app.netlify.com) and click **"Add new site → Import an existing project"**.
3. Select your `pdf-merger` repository.
4. Leave the **Build command** empty and set **Publish directory** to `.` (root).
5. Click **"Deploy site"**.

### Netlify CLI

```bash
# Deploy from project root
netlify deploy --dir . --prod
```

The included `netlify.toml` configures:
- **Publish directory:** root (`.`)
- **Security headers:** CSP, X-Frame-Options, X-Content-Type-Options, etc.
- **Cache headers:** Immutable caching for static assets, no-cache for `sw.js`.

---

## 🔒 Privacy & Security

- **Zero Server Uploads**: 100% of PDF processing happens locally in the browser's JavaScript sandbox.
- **Strict CSP**: Configured in `netlify.toml` to protect against unauthorized script execution and injections.
- **Sanitized Filenames**: Download filenames are sanitized to prevent illegal characters or path traversal.
- **Memory Management**: Generated Object URLs are automatically revoked to prevent memory leaks.

---

## 📦 Dependencies (CDN)

| Library | Version | Purpose |
|---|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | PDF creation, page extraction, rotation, and serialisation |
| [SortableJS](https://sortablejs.github.io/Sortable/) | 1.15.3 | Drag-and-drop list and grid reordering |
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | Rendering high-fidelity page thumbnails in canvas |

---

## 📄 License

MIT – free to use, modify, and distribute.