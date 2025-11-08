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
  keywords: z.array(z.string()).describe('Keywords to include.'),
  tone: z.string().describe('The desired tone (e.g., professional, casual).'),
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

// Schema for the final API response
export const CaptionGenerationResultSchema = z.object({
  captions: z.array(GeneratedCaptionSchema),
  bestCaption: z.string(),
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