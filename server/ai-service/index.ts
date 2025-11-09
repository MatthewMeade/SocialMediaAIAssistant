import { IAiDataRepository, LocalDataRepository } from './repository'
import { chatModel, creativeModel, imageGenerator } from './models'
import { getBrandVoiceScore } from './services/grading-service'
import type { BrandScore } from './schemas'
import type { BaseMessage } from '@langchain/core/messages'
import {
  generateCaptions,
  applySuggestions,
} from './services/generation-service'
import { generateAndStoreImage } from './services/image-generation-service'
import type {
  CaptionGenerationRequest,
  CaptionGenerationResult,
} from './schemas'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DallEAPIWrapper } from '@langchain/openai'
import type { MediaItem } from '../../shared/types'
// Import agent logic when ready
// import { runChatAgent } from './services/agent-service'

class AiService {
  private repo: IAiDataRepository
  private models: {
    chatModel: BaseChatModel
    creativeModel: BaseChatModel
    imageGenerator: DallEAPIWrapper
  }

  constructor(repository: IAiDataRepository, models: { chatModel: BaseChatModel; creativeModel: BaseChatModel; imageGenerator: DallEAPIWrapper }) {
    this.repo = repository
    this.models = models
  }

  /**
   * Public method for the "Brand Voice Content Grader" tool.
   * It fetches auth-scoped data and then calls the pure grading service.
   */
  async gradeCaption(caption: string, calendarId: string): Promise<BrandScore> {
    // 1. Fetch data securely using the repository and context
    const brandRules = await this.repo.getBrandRules(calendarId)

    // 2. Call the pure AI service
    return getBrandVoiceScore(caption, brandRules, this.models.chatModel)
  }

  /**
   * Public method for the "Caption Generator" tool.
   * Fetches auth-scoped data and calls the generation/refinement service.
   */
  async generateCaptions(
    request: CaptionGenerationRequest,
    calendarId: string,
  ): Promise<CaptionGenerationResult> {
    // 1. Fetch data securely
    const brandRules = await this.repo.getBrandRules(calendarId)

    // 2. Call the AI service
    // Use the powerful model for creative generation
    // Use the faster model for grading
    return await generateCaptions(
      request,
      brandRules,
      this.models.creativeModel,
      (caption, rules) =>
        getBrandVoiceScore(caption, rules, this.models.chatModel),
    )
  }

  /**
   * Public method for the "Apply Suggestions" tool.
   * Calls the simple suggestion application service.
   */
  async applySuggestions(
    caption: string,
    suggestions: string[],
  ): Promise<string> {
    // Call the pure AI service
    // Use the faster model for this direct refinement task
    return await applySuggestions(caption, suggestions, this.models.chatModel)
  }

  /**
   * Public method for the general chatbot.
   * This will be responsible for creating user-scoped tools and running the agent.
   */
  async runChat(
    input: string,
    history: BaseMessage[],
    userId: string,
    calendarId: string,
  ): Promise<string> {
    // This is where you'd implement Goal 5 & 6.
    // We will build this out in server/ai-service/services/agent-service.ts
    // For now, we can stub it:
    console.log(
      `Running chat for user ${userId} on calendar ${calendarId} with input: ${input}`,
    )
    console.log({ history })
    // const agentResponse = await runChatAgent(input, history, userId, calendarId, this.repo);
    // return agentResponse;
    return 'Chatbot functionality is not yet implemented.'
  }

  /**
   * Public method for generating and saving an image.
   * Generates an image using DALL-E, downloads it, and stores it in Supabase.
   */
  async generateAndSaveImage(
    prompt: string,
    calendarId: string,
    userId: string,
  ): Promise<MediaItem> {
    return generateAndStoreImage(
      prompt,
      calendarId,
      userId,
      this.models.imageGenerator,
    )
  }
}

// Initialize the service with the local repository
// This is the single instance your server will use.
const aiService = new AiService(new LocalDataRepository(), { chatModel, creativeModel, imageGenerator })

export default aiService