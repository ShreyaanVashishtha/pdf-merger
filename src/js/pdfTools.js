/**
 * pdfTools.js – Comprehensive client-side PDF processing module via pdf-lib.
 *
 * Capabilities:
 *  - Fast page count & metadata inspection
 *  - Advanced PDF merging (page ranges, page reordering, page rotation)
 *  - PDF splitting (extract ranges, single pages, fixed page intervals)
 *  - PDF page rotation (rotate all or specific pages)
 */

/**
 * Reads a File object as an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Safely loads a PDFDocument with pdf-lib.
 * Handles permission-encrypted PDFs (ignoreEncryption: true) and provides clean error messages.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} fileName
 * @returns {Promise<any>}
 */
export async function loadPdfDocument(arrayBuffer, fileName = 'PDF') {
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib is not loaded. Please check your internet connection or reload the page.');
  }

  const { PDFDocument } = PDFLib;
  try {
    return await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      parseSpeed: PDFLib.ParseSpeeds ? PDFLib.ParseSpeeds.Fast : undefined,
    });
  } catch (err) {
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    if (
      err.name === 'EncryptedPDFError' ||
      msg.includes('encrypt') ||
      msg.includes('password')
    ) {
      throw new Error(`"${fileName}" is password-protected. Please remove the password before processing.`);
    }
    throw new Error(`"${fileName}" could not be parsed as a valid PDF: ${err.message}`);
  }
}

/**
 * Quick inspection to get the page count of a PDF file.
 * @param {File} file
 * @returns {Promise<number>}
 */
export async function getPdfPageCount(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const doc = await loadPdfDocument(arrayBuffer, file.name);
  return doc.getPageCount();
}

/**
 * Merge an ordered list of FileEntry or File objects into a single PDF.
 *
 * @param {Array<import('./fileManager.js').FileEntry|File>} fileEntries - Ordered array of file entries or files
 * @param {(progress: number, label: string) => void} onProgress
 * @returns {Promise<Uint8Array>} Merged PDF bytes
 */
export async function mergePdfs(fileEntries, onProgress) {
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib is not loaded. Please check your internet connection.');
  }

  const { PDFDocument, degrees } = PDFLib;
  onProgress(0, 'Preparing merge…');

  const mergedPdf = await PDFDocument.create();
  const totalFiles = fileEntries.length;

  for (let i = 0; i < totalFiles; i++) {
    const entry = fileEntries[i];
    const file = (entry instanceof File || !entry.file) ? entry : entry.file;

    onProgress(
      Math.round((i / totalFiles) * 70),
      `Reading "${file.name}" (${i + 1}/${totalFiles})`
    );

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const srcDoc = await loadPdfDocument(arrayBuffer, file.name);

    const totalDocPages = srcDoc.getPageCount();

    // Determine which pages to copy and in what order
    let targetIndices = [];
    if (entry.customPages && entry.customPages.length > 0) {
      targetIndices = entry.customPages.filter(p => !p.excluded).map(p => p.originalIndex);
    } else if (entry.parsedIndices && entry.parsedIndices.length > 0) {
      targetIndices = entry.parsedIndices;
    } else {
      targetIndices = srcDoc.getPageIndices();
    }

    // Filter out any out-of-bounds indices just in case
    targetIndices = targetIndices.filter(idx => idx >= 0 && idx < totalDocPages);

    if (targetIndices.length === 0) {
      continue;
    }

    // Copy selected pages
    const copiedPages = await mergedPdf.copyPages(srcDoc, targetIndices);

    // Apply document and per-page rotations
    copiedPages.forEach((page, pageIdx) => {
      const originalIndex = targetIndices[pageIdx];
      let additionalRotation = entry.rotation || 0;

      if (entry.customPages) {
        const custom = entry.customPages.find(p => p.originalIndex === originalIndex);
        if (custom && custom.rotation) {
          additionalRotation = (additionalRotation + custom.rotation) % 360;
        }
      }

      if (additionalRotation !== 0) {
        const rot = page.getRotation ? page.getRotation() : 0;
        const currentAngle = typeof rot === 'number' ? rot : (rot?.angle || 0);
        const finalAngle = ((currentAngle + additionalRotation) % 360 + 360) % 360;
        page.setRotation(degrees(finalAngle));
      }

      mergedPdf.addPage(page);
    });

    onProgress(
      Math.round(70 + ((i + 1) / totalFiles) * 20),
      `Added ${copiedPages.length} page${copiedPages.length === 1 ? '' : 's'} from "${file.name}"`
    );
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error('No pages were selected to merge. Please check your page range settings.');
  }

  onProgress(92, 'Generating final PDF…');
  const pdfBytes = await mergedPdf.save({ useObjectStreams: false });
  onProgress(100, 'Done!');

  return pdfBytes;
}

/**
 * Split a PDF file or extract specific pages.
 *
 * @param {File} file - Source PDF file
 * @param {'extract'|'all'|'fixed'} mode - Split mode
 * @param {Object} options
 * @param {string} [options.pageRange] - For 'extract' mode (e.g. "1-3, 5")
 * @param {number} [options.interval=1] - For 'fixed' mode (e.g. every 2 pages)
 * @param {(progress: number, label: string) => void} onProgress
 * @returns {Promise<Array<{ name: string, bytes: Uint8Array }>>}
 */
export async function splitPdf(file, mode, options, onProgress) {
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib is not loaded. Please check your internet connection.');
  }

  const { PDFDocument } = PDFLib;
  onProgress(5, `Loading "${file.name}"…`);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const srcDoc = await loadPdfDocument(arrayBuffer, file.name);
  const totalPages = srcDoc.getPageCount();

  const baseName = file.name.replace(/\.pdf$/i, '');
  const results = [];

  if (mode === 'extract') {
    const { parsePageRange } = await import('./pageRange.js?v=2.3.0');
    const parsed = parsePageRange(options.pageRange || 'all', totalPages);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (parsed.indices.length === 0) {
      throw new Error('No pages selected to extract.');
    }

    onProgress(40, `Extracting ${parsed.indices.length} pages…`);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, parsed.indices);
    copiedPages.forEach(p => newDoc.addPage(p));

    const bytes = await newDoc.save({ useObjectStreams: false });
    results.push({
      name: `${baseName}_extracted.pdf`,
      bytes,
    });
  } else if (mode === 'all') {
    // Split each page into its own PDF
    for (let i = 0; i < totalPages; i++) {
      onProgress(
        Math.round(10 + (i / totalPages) * 80),
        `Splitting page ${i + 1} of ${totalPages}…`
      );
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(copiedPage);
      const bytes = await newDoc.save({ useObjectStreams: false });
      const pageStr = String(i + 1).padStart(String(totalPages).length, '0');
      results.push({
        name: `${baseName}_page_${pageStr}.pdf`,
        bytes,
      });
    }
  } else if (mode === 'fixed') {
    const interval = Math.max(1, options.interval || 1);
    let partNum = 1;
    for (let i = 0; i < totalPages; i += interval) {
      const chunkIndices = [];
      for (let j = i; j < Math.min(i + interval, totalPages); j++) {
        chunkIndices.push(j);
      }

      onProgress(
        Math.round(10 + (i / totalPages) * 80),
        `Extracting part ${partNum} (pages ${i + 1}–${chunkIndices[chunkIndices.length - 1] + 1})…`
      );

      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, chunkIndices);
      copiedPages.forEach(p => newDoc.addPage(p));
      const bytes = await newDoc.save({ useObjectStreams: false });

      results.push({
        name: `${baseName}_part_${partNum}.pdf`,
        bytes,
      });
      partNum++;
    }
  }

  onProgress(100, 'Split completed!');
  return results;
}

/**
 * Rotate pages of a single PDF document.
 *
 * @param {File} file
 * @param {number|Map<number, number>} rotationOrMap - Angle (90, 180, 270) or Map of pageIndex -> angle
 * @param {(progress: number, label: string) => void} onProgress
 * @returns {Promise<Uint8Array>} Rotated PDF bytes
 */
export async function rotatePdf(file, rotationOrMap, onProgress) {
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib is not loaded. Please check your internet connection.');
  }

  const { PDFDocument, degrees } = PDFLib;
  onProgress(10, `Loading "${file.name}"…`);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const doc = await loadPdfDocument(arrayBuffer, file.name);
  const pages = doc.getPages();

  onProgress(40, 'Applying rotations…');
  pages.forEach((page, idx) => {
    let delta = 0;
    if (typeof rotationOrMap === 'number') {
      delta = rotationOrMap;
    } else if (rotationOrMap instanceof Map && rotationOrMap.has(idx)) {
      delta = rotationOrMap.get(idx) || 0;
    }

    if (delta !== 0) {
      const rot = page.getRotation ? page.getRotation() : 0;
      const currentAngle = typeof rot === 'number' ? rot : (rot?.angle || 0);
      const finalAngle = ((currentAngle + delta) % 360 + 360) % 360;
      page.setRotation(degrees(finalAngle));
    }
  });

  onProgress(80, 'Saving rotated document…');
  const bytes = await doc.save({ useObjectStreams: false });
  onProgress(100, 'Done!');
  return bytes;
}
