/**
 * thumbnailRenderer.js – Renders PDF page thumbnails to HTML Canvas or Data URLs.
 * Uses PDF.js when available, with a responsive canvas placeholder fallback.
 */

import { readFileAsArrayBuffer } from './pdfTools.js?v=2.3.0';

// Cache for loaded PDFDocumentLoadingTask objects
const docCache = new Map();

// Cache for generated thumbnail data URLs
const thumbCache = new Map();

let workerBlobUrl = null;

/**
 * Configure PDF.js worker if available using a same-origin Blob trampoline
 * to avoid cross-origin Worker security restrictions across browsers.
 */
function ensurePdfjsConfigured() {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        if (!workerBlobUrl) {
          const workerCode = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');`;
          const blob = new Blob([workerCode], { type: 'application/javascript' });
          workerBlobUrl = URL.createObjectURL(blob);
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
      } catch (e) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    }
    return true;
  }
  return false;
}

/**
 * Loads a PDF Document with PDF.js
 * @param {File} file
 * @returns {Promise<any>}
 */
async function getPdfJsDoc(file) {
  const key = `${file.name}_${file.size}_${file.lastModified}`;
  if (docCache.has(key)) {
    return docCache.get(key);
  }

  if (!ensurePdfjsConfigured()) {
    return null;
  }

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    docCache.set(key, pdfDoc);
    return pdfDoc;
  } catch (err) {
    console.warn('[ThumbnailRenderer] PDF.js load error:', err);
    return null;
  }
}

/**
 * Render a page thumbnail onto a canvas element or return a data URL.
 *
 * @param {File} file - PDF file
 * @param {number} pageIndex - 0-based page index
 * @param {number} [rotation=0] - Additional rotation angle (0, 90, 180, 270)
 * @param {number} [targetWidth=140] - Desired thumbnail width in pixels
 * @returns {Promise<string>} Data URL of the thumbnail image
 */
export async function renderPageThumbnail(file, pageIndex, rotation = 0, targetWidth = 140) {
  const cacheKey = `${file.name}_${file.size}_p${pageIndex}_r${rotation}_w${targetWidth}`;
  if (thumbCache.has(cacheKey)) {
    return thumbCache.get(cacheKey);
  }

  const pdfDoc = await getPdfJsDoc(file);

  if (pdfDoc) {
    try {
      const renderPromise = (async () => {
        const page = await pdfDoc.getPage(pageIndex + 1); // 1-indexed
        const unscaledViewport = page.getViewport({ scale: 1, rotation });
        const scale = targetWidth / Math.max(1, unscaledViewport.width);
        const viewport = page.getViewport({ scale, rotation });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.85);
      })();

      // 4-second timeout to prevent complex pages from hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Thumbnail render timeout')), 4000)
      );

      const dataUrl = await Promise.race([renderPromise, timeoutPromise]);
      thumbCache.set(cacheKey, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn(`[ThumbnailRenderer] Render page ${pageIndex + 1} fallback:`, err.message);
    }
  }

  // Fallback: draw an SVG placeholder thumbnail
  const fallbackUrl = createPlaceholderThumbnail(pageIndex + 1, file.name);
  thumbCache.set(cacheKey, fallbackUrl);
  return fallbackUrl;
}

/**
 * Creates a crisp fallback SVG thumbnail when PDF.js is unavailable.
 * @param {number} pageNum
 * @param {string} fileName
 * @returns {string} Data URL
 */
function createPlaceholderThumbnail(pageNum, fileName) {
  const width = 140;
  const height = 180;
  const safeName = (fileName || 'PDF').replace(/[<>&"]/g, '');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="14" y="20" width="${width - 28}" height="10" rx="3" fill="#e2e8f0"/>
      <rect x="14" y="38" width="${width - 44}" height="6" rx="2" fill="#e2e8f0"/>
      <rect x="14" y="50" width="${width - 34}" height="6" rx="2" fill="#e2e8f0"/>
      <rect x="14" y="62" width="${width - 50}" height="6" rx="2" fill="#e2e8f0"/>
      <rect x="14" y="74" width="${width - 38}" height="6" rx="2" fill="#e2e8f0"/>
      <circle cx="${width / 2}" cy="${height / 2 + 10}" r="22" fill="#4f46e5" fill-opacity="0.12"/>
      <text x="${width / 2}" y="${height / 2 + 17}" font-family="sans-serif" font-size="20" font-weight="700" fill="#4f46e5" text-anchor="middle">${pageNum}</text>
      <text x="${width / 2}" y="${height - 14}" font-family="sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">${safeName.slice(0, 16)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
