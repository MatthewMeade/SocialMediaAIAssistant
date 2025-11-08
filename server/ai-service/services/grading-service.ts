import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { PromptTemplate } from '@langchain/core/prompts'
import type { BrandRule } from '../../../shared/types'
import { BrandScoreSchema, type BrandScore } from '../schemas'

const graderPromptTemplate = new PromptTemplate({
  template: `You are an expert brand voice analyst. Your task is to grade a post caption against a set of brand voice rules.

Provide a score (0-100) and a brief justification for each rule. The score should reflect how well the caption adheres to the rule.
Then, provide an overall score (0-100) and 2-3 actionable suggestions for improvement.

**Brand Rules:**
{rules}

**Post Caption:**
{caption}
`,
  inputVariables: ['rules', 'caption'],
})

/**
 * Grades a caption against a set of brand rules using a structured output chain.
 * This function is "pure" and does not handle auth or data fetching.
 */
export async function getBrandVoiceScore(
  caption: string,
  brandRules: BrandRule[],
  chatModel: BaseChatModel,
): Promise<BrandScore> {
  // Format rules for the prompt
  const rulesString = brandRules
    .filter((r) => r.enabled)
    .map((r) => `- **${r.title} (ID: ${r.id}):** ${r.description}`)
    .join('\n')

  if (!rulesString) {
    // No enabled rules, return a default score
    return {
      overall: 100,
      rules: [],
      suggestions: ['No active brand rules were provided to grade against.'],
    }
  }

  // Create the chain with structured output
  const chain = graderPromptTemplate.pipe(
    chatModel.withStructuredOutput(BrandScoreSchema, {
      name: 'brand_voice_grader',
    }),
  )

  return await chain.invoke({
    rules: rulesString,
    caption: caption || '(No caption provided)',
  })
}