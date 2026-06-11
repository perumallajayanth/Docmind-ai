/**
 * Retrieves the top 3 most relevant chunks based on keyword overlap scoring.
 * Performs lowercase case-insensitive comparison and returns matches sorted descending.
 * 
 * @param {string} question - The user's query.
 * @param {Array<{ id: string, content: string }>} chunks - Array of text chunks.
 * @returns {Array<{ id: string, content: string }>} Top 3 matching chunks, sorted descending by score.
 */
export function retrieveRelevantChunks(question, chunks) {
  if (!question || !chunks || chunks.length === 0) return []

  // Tokenize question into lowercase words
  const questionWords = question
    .toLowerCase()
    .split(/[\s,.:;?!"'()\-[\]]+/)
    .filter(word => word.length > 1) // Ignore single characters or punctuation

  if (questionWords.length === 0) {
    return chunks.slice(0, 3) // Fallback to first 3 chunks if query contains no indexable words
  }

  // Score each chunk based on word overlaps
  const scoredChunks = chunks.map(chunk => {
    const chunkTextLower = chunk.content.toLowerCase()
    let score = 0

    // Count how many unique question words appear in the chunk content
    questionWords.forEach(word => {
      if (chunkTextLower.includes(word)) {
        score += 1
      }
    })

    return {
      chunk,
      score
    }
  })

  // Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score)

  // Return the top 3 chunks (extracting the original chunk objects)
  return scoredChunks.slice(0, 3).map(item => item.chunk)
}
