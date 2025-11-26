import { z } from 'zod'

// Corresponds to the BrandScore type in shared/types.ts
export const RuleScoreSchema = z.object({
  ruleId: z.string().describe('The ID of the brand rule being evaluated.'),
  score: z.number().min(0).max(100).describe('The score (0-100) for this specific rule.'),
  feedback: z.string().describe('The justification for the score, explaining how the caption met or failed the rule.'),
})

export const BrandScoreSchema = z.object({
  overall: z.number().min(0).max(100).describe('The overall weighted score (0-100) for the caption.'),
  rules: z.array(RuleScoreSchema).describe('The breakdown of scores for each individual brand rule.'),
  suggestions: z.array(z.string()).describe('Specific, actionable suggestions for improving the caption to better match the brand voice.'),
})

// This matches the type in shared/types.ts
export type BrandScore = z.infer<typeof BrandScoreSchema>

// Schema for the API request to generate captions
export const CaptionGenerationRequestSchema = z.object({
  topic: z.string().describe('The main topic of the post.'),
  existingCaption: z.string().optional().describe('An existing caption to edit or refine.'),
})
export type CaptionGenerationRequest = z.infer<
  typeof CaptionGenerationRequestSchema
>

// Schema for a single generated caption result
export const GeneratedCaptionSchema = z.object({
  caption: z.string(),
  score: BrandScoreSchema.nullable(),
})
export type GeneratedCaption = z.infer<typeof GeneratedCaptionSchema>

// Schema for the final API response - returns a single caption
export const CaptionGenerationResultSchema = z.object({
  caption: z.string().describe('The generated caption.'),
  // score: BrandScoreSchema.nullable().describe('The brand score for the generated caption.'),
})
export type CaptionGenerationResult = z.infer<
  typeof CaptionGenerationResultSchema
>

// Schema for the API request to apply suggestions
export const ApplySuggestionsRequestSchema = z.object({
  caption: z.string().describe('The original caption to be improved.'),
  suggestions: z.array(z.string()).describe('The list of suggestions from the grader.'),
  calendarId: z.string().describe('The calendar ID for auth scoping.'),
})
export type ApplySuggestionsRequest = z.infer<
  typeof ApplySuggestionsRequestSchema
>

// Schema for extracted brand rules from a document
export const ExtractedBrandRulesSchema = z.object({
  rules: z.array(
    z.object({
      title: z.string().describe("A concise title for the brand rule (e.g., 'Use Emojis Sparingly')"),
      description: z.string().describe("A detailed explanation of the rule and how to apply it."),
    })
  ).describe("A list of brand guidelines extracted from the text."),
})
export type ExtractedBrandRules = z.infer<typeof ExtractedBrandRulesSchema>

// Schema for Guardrail Decisions
export const GuardrailDecisionSchema = z.object({
  isAllowed: z.boolean().describe("Whether the user input is relevant to the allowed topics."),
  refusalMessage: z.string().nullable().describe("A polite, single-sentence refusal message if not allowed. Null if allowed."),
})

export type GuardrailDecision = z.infer<typeof GuardrailDecisionSchema>

// Schema for Planning Decisions
// Note: OpenAI structured outputs require optional fields to also be nullable
export const PlanSchema = z.object({
  workflowId: z.string().nullable().optional().describe("The ID of the matched workflow from the provided list, if any."),
  steps: z.array(z.string()).nullable().optional().describe("The specific, ordered list of steps the agent should take."),
  reasoning: z.string().describe("Brief explanation of why this plan was chosen (or why no plan is needed).")
})

export type Plan = z.infer<typeof PlanSchema>