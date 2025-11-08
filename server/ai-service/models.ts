// Using OpenAI as an example. You can swap this with ChatGoogleGenerativeAi
// or any other LangChain-compatible model.
import { ChatOpenAI } from '@langchain/openai'

// Ensure you have OPENAI_API_KEY in your .env or .env.local
export const chatModel = new ChatOpenAI({
  model: 'gpt-4o-mini', // or 'gpt-4o', 'gpt-3.5-turbo'
  temperature: 0.2,
})

// You can also export other models, e.g., a more creative one for generation
export const creativeModel = new ChatOpenAI({
  model: 'gpt-4o',
  temperature: 0.7,
})