import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";
import { GuardrailDecisionSchema, type GuardrailDecision } from "../schemas";
import { getPrompt, Prompt } from "../prompts/prompts";
import { langfuseHandler } from "../../lib/langfuse";

export class GuardrailService {
  private model: BaseChatModel;

  constructor(model: BaseChatModel) {
    this.model = model;
  }

  /**
   * Formats the last few messages of history to provide context 
   * without overloading the context window.
   */
  private formatHistory(messages: BaseMessage[]): string {
    return messages
      .slice(-4) // Keep last 4 messages for context
      .map((msg) => {
        const type = (msg as any)._getType?.() || msg.constructor.name;
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : Array.isArray(msg.content)
          ? msg.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
          : String(msg.content || '');
        return `${type}: ${content}`;
      })
      .join("\n");
  }

  /**
   * Validates the input against the allowed topics.
   * Returns a structured decision object.
   */
  async validate(input: string, history: BaseMessage[] = []): Promise<GuardrailDecision> {
    try {
      // 1. Fetch managed prompt from Langfuse
      const promptTemplate = await getPrompt(Prompt.Guardrail);

      // 2. Create chain with structured output for strict boolean logic
      const chain = promptTemplate.pipe(
        this.model.withStructuredOutput(GuardrailDecisionSchema, {
          name: "input_guardrail",
        })
      );

      // 3. Execute with Langfuse tracing
      return await chain.invoke(
        {
          input,
          history: this.formatHistory(history),
        },
        { 
          callbacks: [langfuseHandler], // Trace this specific evaluation
          runName: "Guardrail Evaluation"
        }
      );
    } catch (error) {
      console.error("[GuardrailService] Validation failed:", error);
      // Fail Open: If the guardrail service errors (e.g., network issue), 
      // we default to allowing the request rather than blocking the user entirely.
      return { isAllowed: true, refusalMessage: null };
    }
  }
}

