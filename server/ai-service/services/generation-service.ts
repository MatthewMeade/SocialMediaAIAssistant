import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { PromptTemplate } from '@langchain/core/prompts'
import type { BrandRule } from '../../../shared/types'
import type {
  CaptionGenerationRequest,
    CaptionGenerationResult,
  ExtractedBrandRules,
} from '../schemas'
import { ExtractedBrandRulesSchema } from '../schemas'
import { langfuseHandler } from '../../../server/lib/langfuse'
import { getPrompt, Prompt } from '../prompts/prompts'

function extractTextFromMessage(message: any): string {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((block: any) => (typeof block === 'string' ? block : block.text || ''))
      .join('')
  }
  return String(message.content || '')
}


const applySuggestionsPromptTemplate = new PromptTemplate({
  template: `You are an expert social media copywriter. Your task is to rewrite a post caption to incorporate a specific list of suggestions.

**Original Caption:**
{caption}

**Suggestions to Apply:**
{suggestions}

Rewrite the caption to apply all suggestions. Output only the new, improved caption.
`,
  inputVariables: ['caption', 'suggestions'],
})



export async function generateCaptions(
  request: CaptionGenerationRequest,
  brandRules: BrandRule[],
  creativeModel: BaseChatModel,
): Promise<CaptionGenerationResult> {
  try {
    const enabledRules = brandRules.filter((r) => r.enabled)
    const rulesString = enabledRules
      .map((r) => `- ${r.title}: ${r.description}`)
      .join('\n')

    const generationPromptTemplate = await getPrompt(Prompt.CaptionGeneration)
    const generationChain = generationPromptTemplate.pipe(creativeModel)

    const rulesForPrompt = rulesString || "No specific brand voice rules are currently active."
    const result = await generationChain.invoke({
      topic: request.topic,
      rules: rulesForPrompt,
    }, { callbacks: [langfuseHandler] })

    const initialCaption = extractTextFromMessage(result)

    return {
      caption: initialCaption,
    }
  } catch (error) {
    console.log('generateCaptions', { error })
    throw error;
  }
}

export async function applySuggestions(
  caption: string,
  suggestions: string[],
  chatModel: BaseChatModel,
): Promise<string> {
  try {
    const chain = applySuggestionsPromptTemplate.pipe(chatModel)

    const suggestionsString = suggestions.map((s) => `- ${s}`).join('\n')

    const result = await chain.invoke({
      caption: caption || '(No caption provided)',
      suggestions: suggestionsString,
    }, { callbacks: [langfuseHandler] })

    return extractTextFromMessage(result);
  } catch (error) {
    console.log('applySuggestions', { error })
    throw error;
  }
}

const extractionPromptTemplate = new PromptTemplate({
  template: `You are an expert brand strategist. Your task is to analyze the provided brand guidelines document and extract a structured list of actionable brand voice rules.

  The rules will be used to grade social media content before publishing, Ignore any rules that cannot be validated by reading the post content. 

**Input Text:**

{text}

Extract distinct, actionable rules. Each rule must have a clear title and a description explaining how to apply it. Ignore administrative text or filler.



`,
  inputVariables: ["text"],
})

export async function extractBrandRules(
  text: string,
  chatModel: BaseChatModel,
): Promise<ExtractedBrandRules> {
  const chain = extractionPromptTemplate.pipe(
    chatModel.withStructuredOutput(ExtractedBrandRulesSchema, {
      name: "brand_rules_extractor",
    }),
  )

  return await chain.invoke({ text }, { callbacks: [langfuseHandler] })
}

