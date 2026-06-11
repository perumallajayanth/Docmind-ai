import { supabase } from '../lib/supabase'

/**
 * Quiz Generator Service
 * Communicates with OpenRouter to generate custom count of MCQs from the uploaded PDF text.
 */
export async function generateQuiz(pdfText, count = 5) {
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

  // Slice text to avoid exceeding token limits of GPT-3.5 or other LLMs (around ~12k tokens max)
  const context = pdfText.slice(0, 45000);

  const systemMessage = `You are a professional educational assistant.
Your task is to generate a comprehensive, high-quality study quiz based ONLY on the provided text.

Strict Prompt Rules:
1. Generate questions ONLY from the provided PDF text.
2. Never use outside or external knowledge.
3. Do not hallucinate facts, dates, names, or figures.
4. Do not create duplicate questions.
5. Every question must test a different concept.
6. If the provided information is missing, incomplete, or insufficient, skip generating those questions.
7. Return exactly ${count} multiple-choice questions.

You MUST format your output ONLY as a valid JSON array of exactly ${count} multiple-choice questions (MCQs).
Do not include any introductory text, markdown code blocks (like \`\`\`json or \`\`\`), or additional commentary.
Return raw valid JSON ONLY.`;

  const userMessage = `Generate exactly ${count} MCQs from the following context text.
Each question object MUST have the following structure:
{
  "id": <integer, starting from 1>,
  "question": "<clear and challenging question based on the text>",
  "options": ["<Option A>", "<Option B>", "<Option C>", "<Option D>"],
  "correct": <integer from 0 to 3 representing the index of the correct option>,
  "explanation": "<brief explanation of why the correct option is right based on the text>"
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
      throw new Error('Failed to generate quiz: No choices returned from OpenRouter.');
    }

    const content = data.choices[0].message.content.trim();
    
    // Attempt parsing JSON
    let parsedQuiz;
    try {
      // LLMs sometimes wrap responses in markdown code blocks: ```json [...] ```
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      parsedQuiz = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse raw LLM output as JSON. Raw content:', content);
      throw new Error('Failed to parse generated quiz structure. Please try again.', { cause: parseError });
    }

    if (!Array.isArray(parsedQuiz)) {
      throw new Error('Generated quiz response is not a valid JSON array.');
    }

    // Standardize to ensure robust structure matching the Dashboard schema
    return parsedQuiz.slice(0, count).map((item, idx) => {
      const id = typeof item.id === 'number' ? item.id : idx + 1;
      const question = item.question || 'Missing question title.';
      const options = Array.isArray(item.options) && item.options.length === 4
        ? item.options
        : ['Option A', 'Option B', 'Option C', 'Option D'];
      const correct = typeof item.correct === 'number' && item.correct >= 0 && item.correct <= 3
        ? item.correct
        : 0;
      const explanation = item.explanation || 'Refer to the text content for more detail.';

      return {
        id,
        question,
        options,
        correct,
        selected: null,
        explanation
      };
    });

  } catch (error) {
    console.error('Error in generateQuiz service:', error);
    throw error;
  }
}
