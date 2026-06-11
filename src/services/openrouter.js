import { supabase } from '../lib/supabase'

export async function askAI(
    question,
    context,
    chatHistory = []
) {
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

    try {
        const lowerQuestion = question.toLowerCase()

        const isPersonalQuestion =
            lowerQuestion.includes('my name') ||
            lowerQuestion.includes('who am i') ||
            lowerQuestion.includes('what do i like') ||
            lowerQuestion.includes('favorite color') ||
            lowerQuestion.includes('what is my name')

        const userContent = isPersonalQuestion
            ? question
            : `
Context:

${context}

Question:

${question}
`

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
                            content: `
You are DocMind AI.

There are TWO sources of information:

1. Conversation history
2. Document content

Rules:

- When the user asks about themselves
  (their name, preferences, facts they told you),
  ALWAYS use conversation history.

- When the user asks about the uploaded PDF,
  use document content.

- Never replace user-provided personal information
  with information found in the PDF.

Examples:

User: My name is Jayanth
User: What is my name?
Assistant: Your name is Jayanth

User: I like blue
User: What color do I like?
Assistant: You like blue

User: Summarize the PDF
Assistant: Uses document content
`
                        },

                        ...chatHistory,

                        {
                            role: 'user',
                            content: userContent
                        }
                    ]
                })
            }
        )

        if (!response.ok) {
            if (response.status === 401) {
                return 'Authentication Error: Your custom OpenRouter API key is invalid or expired. Please check your Settings.'
            }
            const errData = await response.json().catch(() => ({}))
            const errMsg = errData?.error?.message || response.statusText
            return `OpenRouter API error: ${errMsg}`
        }

        const data = await response.json()

        console.log('OPENROUTER RESPONSE:', data)

        return data.choices?.[0]?.message?.content || 'No response generated.'
    } catch (error) {
        console.error(error)
        return 'Error generating answer.'
    }
}