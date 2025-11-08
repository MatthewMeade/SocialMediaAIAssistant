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