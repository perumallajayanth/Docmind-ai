/**
 * Splits extracted PDF text into overlapping character-based chunks.
 * 
 * @param {string} text - The raw parsed text extracted from the PDF.
 * @param {number} [size=1000] - The target character length of each text chunk.
 * @param {number} [overlap=200] - The number of characters of overlapping text between adjacent chunks.
 * @returns {Array<{
 *   id: string,
 *   content: string,
 *   startIndex: number,
 *   endIndex: number
 * }>}
 */
export function chunkText(text, size = 1000, overlap = 200) {
    if (!text) return []

    const chunks = []
    const textLength = text.length
    let startIndex = 0
    let chunkCounter = 0

    // If the total text length is less than or equal to the target chunk size,
    // simply return the entire text as a single chunk.
    if (textLength <= size) {
        return [{
            id: `chunk-${chunkCounter}`,
            content: text,
            startIndex: 0,
            endIndex: textLength
        }]
    }

    while (startIndex < textLength) {
        let endIndex = startIndex + size

        // Pin the end index to the total text length to avoid overflow
        if (endIndex > textLength) {
            endIndex = textLength
        }

        const content = text.substring(startIndex, endIndex)

        chunks.push({
            id: `chunk-${chunkCounter}`,
            content: content,
            startIndex: startIndex,
            endIndex: endIndex
        })

        chunkCounter++

        // The sliding step size is the chunk size minus the overlap.
        // If the step would be 0 or negative (overlap >= size), default to 1 to avoid an infinite loop.
        const step = size - overlap
        const nextStartIndex = startIndex + (step > 0 ? step : 1)

        // Break the loop if the next start index goes beyond the text boundaries
        if (nextStartIndex >= textLength) {
            break
        }

        // Stop adding chunks if the remaining characters are fully covered by the overlap
        if (endIndex === textLength) {
            break
        }

        startIndex = nextStartIndex
    }

    return chunks
}
