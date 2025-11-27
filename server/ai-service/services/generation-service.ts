import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { PromptTemplate } from '@langchain/core/prompts'
import type { BrandRule } from '../../../shared/types'
import type {
  BrandScore,
  CaptionGenerationRequest,
    CaptionGenerationResult,
  ExtractedBrandRules,
} from '../schemas'
import { ExtractedBrandRulesSchema } from '../schemas'
import { langfuseHandler } from '../../../server/lib/langfuse'
import { getPrompt, Prompt } from '../prompts/prompts'

// Helper function to extract text from message content
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


// This prompt is for refining a failed or existing caption
const refinementPromptTemplate = new PromptTemplate({
  template: `You are an expert social media copywriter. Your task is to refine a post caption that failed to meet brand voice guidelines.

**Brand Voice Rules (ONLY follow these rules, do not add any additional requirements):**
{rules}

**Original Caption:**
{failedCaption}

**Feedback & Issues:**
{feedback}

**Original Post Details:**
- Topic: {topic}

Rewrite the caption to fix the issues, meet ALL brand voice rules listed above, and fulfill the original post topic. Only follow the rules explicitly listed above - do not include any requirements, styles, or elements that are not mentioned in the rules. Output only the new caption.
`,
  inputVariables: [
    'rules',
    'failedCaption',
    'feedback',
    'topic',
  ],
})

// This prompt is for applying a specific list of suggestions
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

type GraderFunction = (
  caption: string,
  brandRules: BrandRule[],
) => Promise<BrandScore>

/**
 * Generates and refines captions using a reflect-refine loop.
 * - If existingCaption is provided, it refines that.
 * - If not, it generates a new one.
 * - It then grades the caption. If it's below a threshold, it refines it once.
 * - Returns only the best single caption.
 */
export async function generateCaptions(
  request: CaptionGenerationRequest,
  brandRules: BrandRule[],
  creativeModel: BaseChatModel,
  // graderFunc: GraderFunction,
): Promise<CaptionGenerationResult> {
  console.log('[Performance] Starting generateCaptions');
  console.time('[Performance] generateCaptions');
  
  try {
    const enabledRules = brandRules.filter((r) => r.enabled)
    const rulesString = enabledRules
      .map((r) => `- ${r.title}: ${r.description}`)
      .join('\n')

    const generationPromptTemplate = await getPrompt(Prompt.CaptionGeneration)
    const generationChain = generationPromptTemplate.pipe(creativeModel)

  // const refinementChain = refinementPromptTemplate.pipe(creativeModel)

  // let initialCaption: string
  //   let initialScore: BrandScore

  // // 1. Get Initial Caption
  // if (request.existingCaption) {
  //   initialCaption = request.existingCaption
  // } else {
  //   // Generate from scratch
  //   // If no enabled rules, use a default message
  //   const rulesForPrompt = rulesString || "No specific brand voice rules are currently active."
  //   const result = await generationChain.invoke({
  //     topic: request.topic,
  //     rules: rulesForPrompt,
  //   }, { callbacks: [langfuseHandler] })
  //   initialCaption = extractTextFromMessage(result)
  // }

    const rulesForPrompt = rulesString || "No specific brand voice rules are currently active."
    const result = await generationChain.invoke({
      topic: request.topic,
      rules: rulesForPrompt,
    }, { callbacks: [langfuseHandler] })

    const initialCaption = extractTextFromMessage(result)

  // 2. Evaluate Initial Caption
  // initialScore = await graderFunc(initialCaption, brandRules)

  // 3. Reflect & Refine (if needed)
  //   if (initialScore.overall < 25 && enabledRules.length > 0) {
  //   // Score is low, refine it once
  //   const feedback = `
  //     Overall Score: ${initialScore.overall}/100.
  //     Suggestions: ${initialScore.suggestions.join(', ')}
  //     Rules Violated: ${initialScore.rules
  //       .filter((r) => r.score < 70)
  //       .map((r) => r.feedback)
  //       .join(', ')}
  //   `

  //   const rulesForRefinement = rulesString || "No specific brand voice rules are currently active."
  //   const result = await refinementChain.invoke({
  //     topic: request.topic,
  //     rules: rulesForRefinement,
  //     failedCaption: initialCaption,
  //     feedback,
  //   }, { callbacks: [langfuseHandler] })
  //   const refinedCaption = extractTextFromMessage(result)

  //   // 4. Evaluate Refined Caption
  //       const refinedScore = await graderFunc(refinedCaption, brandRules)

  //       // 5. Return the best caption (highest score)
  //       if (refinedScore.overall > initialScore.overall) {
  //           return {
  //               caption: refinedCaption,
  //               score: refinedScore,
  //           }
  //       }
  // }

    // Return the initial caption (either it was good enough or refinement didn't help)
    const finalResult = {
      caption: initialCaption,
    // score: initialScore,
    }
    console.timeEnd('[Performance] generateCaptions');
    return finalResult;
  } catch (error) {
    console.timeEnd('[Performance] generateCaptions');
    throw error;
  }
}

/**
 * Applies a specific list of suggestions to an existing caption.
 */
export async function applySuggestions(
  caption: string,
  suggestions: string[],
  chatModel: BaseChatModel,
): Promise<string> {
  console.log('[Performance] Starting applySuggestions');
  console.time('[Performance] applySuggestions');
  
  try {
    const chain = applySuggestionsPromptTemplate.pipe(chatModel)

    const suggestionsString = suggestions.map((s) => `- ${s}`).join('\n')

    const result = await chain.invoke({
      caption: caption || '(No caption provided)',
      suggestions: suggestionsString,
    }, { callbacks: [langfuseHandler] })

    const finalResult = extractTextFromMessage(result);
    console.timeEnd('[Performance] applySuggestions');
    return finalResult;
  } catch (error) {
    console.timeEnd('[Performance] applySuggestions');
    throw error;
  }
}

// Prompt template for extracting brand rules from text
const extractionPromptTemplate = new PromptTemplate({
  template: `You are an expert brand strategist. Your task is to analyze the provided brand guidelines document and extract a structured list of actionable brand voice rules.

  The rules will be used to grade social media content before publishing, Ignore any rules that cannot be validated by reading the post content. 

**Input Text:**

{text}

Extract distinct, actionable rules. Each rule must have a clear title and a description explaining how to apply it. Ignore administrative text or filler.



`,
  inputVariables: ["text"],
})

/**
 * Extracts brand rules from a text document using structured output.
 * This function is "pure" and does not handle auth or data fetching.
 */
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

