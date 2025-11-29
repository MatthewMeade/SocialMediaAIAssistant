import { ChatOpenAI, DallEAPIWrapper } from '@langchain/openai'

export const chatModel = new ChatOpenAI({
  model: 'gpt-4o',
  temperature: 0.2,
  streaming: true
})

export const creativeModel = new ChatOpenAI({
  model: 'gpt-4o',
  temperature: 0.7,
})

export const imageGenerator = new DallEAPIWrapper({
  modelName: 'dall-e-3',
  n: 1,
  size: '1024x1024',
})