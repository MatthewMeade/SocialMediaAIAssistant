import { IAiDataRepository, LocalDataRepository } from './repository'
import { chatModel } from './models'
import { getBrandVoiceScore } from './services/grading-service'
import type { BrandScore } from './schemas'
// Import agent logic when ready
// import { runChatAgent } from './services/agent-service'

class AiService {
  private repo: IAiDataRepository

  constructor(repository: IAiDataRepository) {
    this.repo = repository
  }

  /**
   * Public method for the "Brand Voice Content Grader" tool.
   * It fetches auth-scoped data and then calls the pure grading service.
   */
  async gradeCaption(caption: string, calendarId: string): Promise<BrandScore> {
    // 1. Fetch data securely using the repository and context
    const brandRules = await this.repo.getBrandRules(calendarId)

    // 2. Call the pure AI service
    return getBrandVoiceScore(caption, brandRules, chatModel)
  }

  /**
   * Public method for the general chatbot.
   * This will be responsible for creating user-scoped tools and running the agent.
   */
  async runChat(
    input: string,
    history: any[], // Use BaseMessage[] from langchain
    userId: string,
    calendarId: string,
  ): Promise<string> {
    // This is where you'd implement Goal 5 & 6.
    // We will build this out in server/ai-service/services/agent-service.ts
    // For now, we can stub it:
    console.log(`Running chat for user ${userId} on calendar ${calendarId} with input: ${input}`)
    console.log({history})
    // const agentResponse = await runChatAgent(input, history, userId, calendarId, this.repo);
    // return agentResponse;
    return "Chatbot functionality is not yet implemented."
  }
}

// Initialize the service with the local repository
// This is the single instance your server will use.
const aiService = new AiService(new LocalDataRepository())

export default aiService