import { supabase } from '../lib/supabase'

/**
 * Flashcard Generator Service
 * Communicates with OpenRouter to generate custom count of flashcards from the uploaded PDF text.
 */
export async function generateFlashcards(pdfText, count = 5) {
  let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('user_settings')
        .select('openrouter_key')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data?.openrouter_key) {
        apiKey = data.openrouter_key
      }
    }
  } catch (err) {
    console.error("Error loading user OpenRouter key from Supabase settings:", err)
  }

  if (!pdfText) {
    throw new Error('Upload a PDF first');
  }

  // Slice text to avoid exceeding token limits (around ~12k tokens max)
  const context = pdfText.slice(0, 45000);

  const systemMessage = `You are a professional educational assistant.
Your task is to generate a comprehensive set of study flashcards based ONLY on the provided text.

Strict Prompt Rules:
1. Generate flashcards ONLY from the provided PDF text.
2. Never use external or outside knowledge.
3. No duplicate cards or redundant concepts.
4. Each card must represent a unique concept.
5. The 'front' of the flashcard must be highly concise (e.g., a key term, question, or core concept).
6. The 'back' of the flashcard must be based entirely on the PDF content (e.g., clear, concise definition, answer, or explanation).
7. Return exactly ${count} flashcard objects.

You MUST format your output ONLY as a valid JSON array of exactly ${count} flashcard objects.
Do not include any introductory text, markdown code blocks (like \`\`\`json or \`\`\`), or additional commentary.
Return raw valid JSON ONLY.`;

  const userMessage = `Generate exactly ${count} flashcards from the following context text.
Each flashcard object MUST have the following structure:
{
  "id": <integer, starting from 1>,
  "front": "<a key term, question, or core concept from the text>",
  "back": "<clear, concise definition, answer, or explanation for the term/concept on the front>"
}

Context Text:
${context}
`;

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemMessage
            },
            {
              role: 'user',
              content: userMessage
            }
          ]
        })
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication Error: Your custom OpenRouter API key is invalid or expired. Please check your Settings.');
      }
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      throw new Error('Failed to generate flashcards: No choices returned from OpenRouter.');
    }

    const content = data.choices[0].message.content.trim();
    
    // Attempt parsing JSON
    let parsedCards;
    try {
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      parsedCards = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse raw LLM output as JSON. Raw content:', content);
      throw new Error('Failed to parse generated flashcards structure. Please try again.', { cause: parseError });
    }

    if (!parsedCards || !Array.isArray(parsedCards)) {
      throw new Error('Generated flashcards response is not a valid JSON array.');
    }

    // Standardize to ensure robust structure matching the Dashboard schema
    return parsedCards.slice(0, count).map((item, idx) => {
      const id = typeof item.id === 'number' ? item.id : idx + 1;
      const front = item.front || 'Concept front placeholder.';
      const back = item.back || 'Concept back explanation.';

      return {
        id,
        front,
        back,
        ease: 2.5,
        interval: 0,
        flipped: false
      };
    });

  } catch (error) {
    console.error('Error in generateFlashcards service:', error);
    throw error;
  }
}
