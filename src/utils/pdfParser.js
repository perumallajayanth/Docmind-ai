import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
/**
 * Extracts raw text page-by-page from an uploaded PDF file using pdfjs-dist.
 * 
 * @param {File} file - The PDF File object from the file input or drag-and-drop zone.
 * @returns {Promise<{
 *   text: string,
 *   pages: { pageNum: number, text: string }[],
 *   pageCount: number,
 *   charCount: number
 * }>}
 */
export async function extractTextFromPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result
        if (!arrayBuffer) {
          throw new Error('Could not read file data buffer.')
        }

        const typedArray = new Uint8Array(arrayBuffer)

        // Load the PDF document binary data
        const loadingTask = pdfjsLib.getDocument({ data: typedArray })
        const pdf = await loadingTask.promise
        const pageCount = pdf.numPages

        let fullText = ''
        const pages = []

        // Extract text page by page sequentially
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()

          // Map and join the string items to rebuild the page text
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ') // Clean up duplicate spacing
            .trim()

          fullText += `[Page ${i}]\n${pageText}\n\n`
          pages.push({ pageNum: i, text: pageText })
        }

        resolve({
          text: fullText,
          pages: pages,
          pageCount: pageCount,
          charCount: fullText.length
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = (error) => {
      reject(error)
    }

    // Read the uploaded file buffer as ArrayBuffer
    reader.readAsArrayBuffer(file)
  })
}
