/**
 * pdfMerger.js – PDF processing module
 *
 * Uses pdf-lib (loaded globally via CDN) to:
 *  - Read each PDF file as an ArrayBuffer
 *  - Merge pages from each document into a single output PDF
 *  - Report progress via a callback
 *  - Return the merged PDF as a Uint8Array
 */

/**
 * Reads a File object as an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Merge an ordered list of PDF File objects into a single PDF.
 *
 * @param {File[]} files - Ordered array of PDF files.
 * @param {(progress: number, label: string) => void} onProgress
 *   Called with a 0–100 progress value and a human-readable label.
 * @returns {Promise<Uint8Array>} The merged PDF bytes.
 * @throws {Error} If pdf-lib is not available or if a file cannot be parsed.
 */
export async function mergePdfs(files, onProgress) {
  // pdf-lib is loaded globally via CDN as window.PDFLib
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib is not loaded. Please check your internet connection.');
  }

  const { PDFDocument } = PDFLib;

  onProgress(0, 'Starting…');

  // Create the output document
  const mergedPdf = await PDFDocument.create();

  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const label = `Reading "${file.name}" (${i + 1}/${totalFiles})`;
    // Progress: reading phase is 0–70 % proportionally
    onProgress(Math.round((i / totalFiles) * 70), label);

    // Read file bytes
    let arrayBuffer;
    try {
      arrayBuffer = await readFileAsArrayBuffer(file);
    } catch (err) {
      throw new Error(`Could not read "${file.name}": ${err.message}`);
    }

    // Load the source PDF
    let srcDoc;
    try {
      srcDoc = await PDFDocument.load(arrayBuffer, {
        // Ignore minor cross-reference errors in some PDFs
        ignoreEncryption: false,
      });
    } catch (err) {
      throw new Error(
        `"${file.name}" could not be parsed as a valid PDF. ` +
        `It may be password-protected or corrupted. (${err.message})`
      );
    }

    // Copy all pages from the source document into the output
    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await mergedPdf.copyPagesFrom(srcDoc, pageIndices);
    copiedPages.forEach(page => mergedPdf.addPage(page));

    // Progress: copying phase is 70–90 %
    onProgress(Math.round(70 + ((i + 1) / totalFiles) * 20), `Added "${file.name}"`);
  }

  // Serialise the merged document
  onProgress(92, 'Saving merged PDF…');
  const pdfBytes = await mergedPdf.save();

  onProgress(100, 'Done!');
  return pdfBytes;
}
