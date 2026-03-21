# PDF Merger

A fully client-side **PDF Merger Web Application** built with plain HTML, CSS, and JavaScript (ES modules). All PDF processing happens in the browser using [pdf-lib](https://pdf-lib.js.org/) — your files never leave your device.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Multi-file upload** | Click to browse or drag-and-drop multiple PDFs at once |
| **Drag-to-reorder** | Rearrange files in any order before merging (SortableJS) |
| **PDF preview** | Inline preview each file before merging |
| **Remove files** | Remove individual files or clear the whole list |
| **Progress bar** | Real-time merge progress with status labels |
| **Error handling** | Validates file type, size (≤ 100 MB per file), and duplicates |
| **Dark mode** | Full dark/light mode with OS preference detection and localStorage persistence |
| **Private** | 100% client-side — nothing is uploaded to a server |
| **Deployable** | Ready to deploy on Netlify (static hosting) |

---

## 🗂 Project Structure

```
pdf-merger/
├── index.html          # Main HTML entry point
├── netlify.toml        # Netlify deployment config & security headers
├── .gitignore
├── README.md
└── src/
    ├── css/
    │   └── styles.css  # All styles (tokens, layout, components, dark mode)
    └── js/
        ├── main.js         # Application entry point – wires everything together
        ├── fileManager.js  # In-memory file list (add, remove, reorder, validate)
        ├── pdfMerger.js    # PDF merging logic via pdf-lib
        ├── ui.js           # All DOM updates (rendering, messages, progress, modal)
        └── utils.js        # Pure utility functions (formatBytes, uid, debounce, …)
```

### Key Modules

| Module | Responsibility |
|---|---|
| `main.js` | Bootstraps the app; connects FileManager ↔ UI ↔ PDF merger; handles events |
| `fileManager.js` | Single source of truth for the file list; validates files; emits change events |
| `pdfMerger.js` | Reads files as ArrayBuffers, loads with pdf-lib, copies pages, serialises output |
| `ui.js` | Pure DOM helpers – renders file list items, progress bar, modal, and banners |
| `utils.js` | Stateless helpers: `formatBytes`, `sanitiseFilename`, `uid`, `debounce` |

---

## 🚀 Local Development

No build step is required. The app uses native ES modules supported in all modern browsers.

### Option 1 – VS Code Live Server (recommended)

1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
2. Open the project folder in VS Code.
3. Click **"Go Live"** in the status bar.

### Option 2 – Python HTTP server

```bash
# Python 3
python3 -m http.server 3000
# Then open http://localhost:3000
```

### Option 3 – Node.js `serve`

```bash
npx serve .
```

> **Note:** Opening `index.html` directly as a `file://` URL will not work because ES modules require an HTTP origin.

---

## ☁️ Deployment on Netlify

### Step-by-step (Netlify UI)

1. Push this repository to GitHub (or fork it).
2. Go to [app.netlify.com](https://app.netlify.com) and click **"Add new site → Import an existing project"**.
3. Connect your GitHub account and select the `pdf-merger` repository.
4. Set the **Build settings**:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.` (root)
5. Click **"Deploy site"**.
6. Netlify will deploy within seconds. Your site URL will appear in the dashboard.

### Step-by-step (Netlify CLI)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy (from project root)
netlify deploy --dir . --prod
```

The included `netlify.toml` configures:
- **Publish directory:** root (`.`)
- **Security headers:** CSP, X-Frame-Options, X-Content-Type-Options, etc.
- **Cache headers:** Long-cache for files under `src/`

---

## 🔒 Security

- All PDF processing is 100% client-side — no data leaves the browser.
- Strict Content-Security-Policy only allows scripts from `self`, `unpkg.com`, and `cdn.jsdelivr.net`.
- File input is validated for type (`application/pdf`) and size (≤ 100 MB).
- Filenames are sanitised before use as download attributes.
- Object URLs are revoked after use to avoid memory leaks.

---

## 📦 Dependencies (CDN – no install needed)

| Library | Version | Purpose |
|---|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | PDF parsing, page copying, and serialisation |
| [SortableJS](https://sortablejs.github.io/Sortable/) | 1.15.3 | Drag-and-drop list reordering |

---

## 🌐 Browser Support

Works in all modern browsers (Chrome, Firefox, Edge, Safari) that support:
- ES Modules (`type="module"`)
- `FileReader` API
- `URL.createObjectURL`
- CSS custom properties

---

## 📄 License

MIT – free to use and modify.