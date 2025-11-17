// This service is not currently used in the routes.
// Routes create repository instances directly with userId and calendarId.
// If you want to use this service in the future, uncomment the code below and ensure
// you pass a repository instance with userId and calendarId:
//
// Example usage:
//   const repo = new LocalDataRepository(userId, calendarId)
//   const aiService = new AiService(repo, { chatModel, creativeModel, imageGenerator })

/*
import type { IAiDataRepository } from './repository'
import { chatModel, creativeModel, imageGenerator } from './models'
import { getBrandVoiceScore } from './services/grading-service'
import type { BrandScore } from './schemas'
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

  async gradeCaption(caption: string): Promise<BrandScore> {
    const brandRules = await this.repo.getBrandRules()
    return getBrandVoiceScore(caption, brandRules, this.models.chatModel)
  }

  async generateCaptions(
    request: CaptionGenerationRequest,
  ): Promise<CaptionGenerationResult> {
    const brandRules = await this.repo.getBrandRules()
    return await generateCaptions(
      request,
      brandRules,
      this.models.creativeModel,
      (caption, rules) =>
        getBrandVoiceScore(caption, rules, this.models.chatModel),
    )
  }

  async applySuggestions(
    caption: string,
    suggestions: string[],
  ): Promise<string> {
    return await applySuggestions(caption, suggestions, this.models.chatModel)
  }

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

export default aiService
*/