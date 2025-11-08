import type { BrandRule } from '../../shared/types'
import { getBrandRules as dbGetBrandRules } from '../lib/db/brand-voice'

/**
 * Interface for the AI service to fetch data.
 * This allows swapping between local DB calls and remote API calls.
 */
export interface IAiDataRepository {
  getBrandRules(calendarId: string): Promise<BrandRule[]>
  // Add other methods here as needed, e.g.:
  // getPost(postId: string): Promise<Post | null>
}

/**
 * Local implementation that calls the database directly.
 */
export class LocalDataRepository implements IAiDataRepository {
  async getBrandRules(calendarId: string): Promise<BrandRule[]> {
    try {
      // Calls the existing function in server/lib/db/brand-voice.ts
      return await dbGetBrandRules(calendarId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching brand rules for calendar ${calendarId}:`, error)
      return []
    }
  }
}

// (For the future, a remote implementation would look like this)
/*
export class ApiDataRepository implements IAiDataRepository {
  private baseUrl: string;
  private apiToken: string; // Service-to-service token

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
  }

  async getBrandRules(calendarId: string): Promise<BrandRule[]> {
    const response = await fetch(`${this.baseUrl}/api/brand-voice?calendarId=${calendarId}`, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });
    if (!response.ok) return [];
    return response.json();
  }
}
*/