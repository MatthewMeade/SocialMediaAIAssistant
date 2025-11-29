import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { PlanSchema, type Plan } from "../schemas";
import { WORKFLOWS, APP_SPEC } from "../workflows";
import { langfuseHandler } from "../../lib/langfuse";

export class PlannerService {
  private model: BaseChatModel;

  constructor(model: BaseChatModel) {
    this.model = model;
  }

  private extractPlan(result: unknown): Plan | null {
    if (!result || typeof result !== 'object') {
      return null;
    }
    return result as Plan;
  }

  async generatePlan(input: string, contextSummary: string): Promise<string | null> {
    try {
      const prompt = PromptTemplate.fromTemplate(`
        You are a strategic planner for a Social Media AI Agent.
        
        **Your Goal:** Determine if the user's request requires a multi-step execution plan.
        
        **Rules for Planning:**
        1. **Simple Chat / Continuation:** If the user is greeting, thanking, confirming a previous action (e.g., "Yes, do it", "Thanks"), or asking a simple question that needs no tools, return NO steps (empty array).

        2. **Workflow Match:** If the request matches a predefined workflow (like "Create Post"), return those specific steps.

        3. **Complex Task:** If the request is complex/ambiguous and needs tools, generate a custom list of steps based on the App Spec.

        **Available Workflows:**

        {workflows}

        **App Specification:**

        {appSpec}

        **Current Context:**

        {context}

        **User Request:**

        {input}
      `);

      const formattedWorkflows = Object.values(WORKFLOWS)
        .map(w => `- ID: ${w.id}\n  Desc: ${w.description}\n  Default Steps:\n${w.steps.join("\n")}`)
        .join("\n\n");

      const chain = prompt.pipe(
        this.model.withStructuredOutput(PlanSchema, { name: "planner" })
      );

      const result = await chain.invoke({
        workflows: formattedWorkflows,
        appSpec: APP_SPEC,
        context: contextSummary,
        input
      }, { callbacks: [langfuseHandler], runName: "Plan Generation" });

      const planResult = this.extractPlan(result);
      if (!planResult) {
        return null;
      }

      if (!planResult.steps || !Array.isArray(planResult.steps) || planResult.steps.length === 0) {
        return null; 
      }

      const plan = `\n\n**CURRENT PLAN:**\n${planResult.steps.map((s: string) => `- ${s}`).join("\n")}\n(Follow this plan strictly.)`;
      return plan;

    } catch (error) {
      console.error("Error generating plan:", error);
      return null;
    }
  }
}

