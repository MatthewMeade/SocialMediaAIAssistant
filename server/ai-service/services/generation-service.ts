import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { PromptTemplate } from '@langchain/core/prompts'
import type { BrandRule } from '../../../shared/types'
import type {
  BrandScore,
  CaptionGenerationRequest,
  CaptionGenerationResult,
  GeneratedCaption,
} from '../schemas'

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

// This prompt is for generating a new caption from scratch
const generationPromptTemplate = new PromptTemplate({
  template: `You are an expert social media copywriter. Your task is to generate a post caption.

**Brand Voice Rules:**
{rules}

**Post Details:**
- Topic: {topic}
- Keywords: {keywords}
- Tone: {tone}

Generate a single, compelling post caption based on these details and adhering strictly to the brand voice rules.
`,
  inputVariables: ['rules', 'topic', 'keywords', 'tone'],
})

// This prompt is for refining a failed or existing caption
const refinementPromptTemplate = new PromptTemplate({
  template: `You are an expert social media copywriter. Your task is to refine a post caption that failed to meet brand voice guidelines.

**Brand Voice Rules:**
{rules}

**Original Caption:**
{failedCaption}

**Feedback & Issues:**
{feedback}

**Original Post Details:**
- Topic: {topic}
- Keywords: {keywords}
- Tone: {tone}

Rewrite the caption to fix the issues, meet all brand voice rules, and fulfill the original post details. Output only the new caption.
`,
  inputVariables: [
    'rules',
    'failedCaption',
    'feedback',
    'topic',
    'keywords',
    'tone',
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
 */
export async function generateCaptions(
  request: CaptionGenerationRequest,
  brandRules: BrandRule[],
  creativeModel: BaseChatModel,
  graderFunc: GraderFunction,
): Promise<CaptionGenerationResult> {
  const rulesString = brandRules
    .filter((r) => r.enabled)
    .map((r) => `- ${r.title}: ${r.description}`)
    .join('\n')

  const generationChain = generationPromptTemplate.pipe(creativeModel)

  const refinementChain = refinementPromptTemplate.pipe(creativeModel)

  const drafts: GeneratedCaption[] = []
  let initialCaption: string

  const keywords = request.keywords.join(', ')

  // 1. Get Initial Caption
  if (request.existingCaption) {
    initialCaption = request.existingCaption
  } else {
    // Generate from scratch
    const result = await generationChain.invoke({
      ...request,
      keywords,
      rules: rulesString,
    })
    initialCaption = extractTextFromMessage(result)
  }

  // 2. Evaluate Initial Caption
  const score1 = await graderFunc(initialCaption, brandRules)
  drafts.push({ caption: initialCaption, score: score1 })

  // 3. Reflect & Refine (if needed)
  if (score1.overall < 85 && brandRules.length > 0) {
    // Score is low, refine it once
    const feedback = `
      Overall Score: ${score1.overall}/100.
      Suggestions: ${score1.suggestions.join(', ')}
      Rules Violated: ${score1.rules
        .filter((r) => r.score < 70)
        .map((r) => r.feedback)
        .join(', ')}
    `

    const result = await refinementChain.invoke({
      ...request,
      keywords,
      rules: rulesString,
      failedCaption: initialCaption,
      feedback,
    })
    const refinedCaption = extractTextFromMessage(result)

    // 4. Evaluate Refined Caption
    const score2 = await graderFunc(refinedCaption, brandRules)
    drafts.push({ caption: refinedCaption, score: score2 })
  }

  // 5. Return Results
  // Sort by score, highest first
  drafts.sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0))

  return {
    captions: drafts,
    bestCaption: drafts[0].caption,
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
  const chain = applySuggestionsPromptTemplate.pipe(chatModel)

  const suggestionsString = suggestions.map((s) => `- ${s}`).join('\n')

  const result = await chain.invoke({
    caption: caption || '(No caption provided)',
    suggestions: suggestionsString,
  })

  return extractTextFromMessage(result)
}

