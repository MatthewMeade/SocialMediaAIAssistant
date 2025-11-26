import { PromptTemplate } from "@langchain/core/prompts";
import { LangfuseClient } from "@langfuse/client";
 
const langfuse = new LangfuseClient();

export enum Prompt {
    CaptionGeneration =  'Caption Generation',
    Guardrail = 'Input Guardrail'
}


export const getPrompt = async (prompt: Prompt) => {
    const langfusePrompt = await langfuse.prompt.get(prompt, {cacheTtlSeconds: 0});
    return PromptTemplate.fromTemplate(langfusePrompt.getLangchainPrompt())
}