import type { BrandRule, Post, MediaItem } from '../../shared/types'
import { getBrandRules as dbGetBrandRules } from '../lib/db/brand-voice'
import { getPosts as dbGetPosts, getPostById as dbGetPostById } from '../lib/db/posts'
import { getMediaByCalendar as dbGetMediaByCalendar } from '../lib/db/media'

/**
 * Interface for the AI service to fetch data.
 * This allows swapping between local DB calls and remote API calls.
 * 
 * This is a "dumb" data layer - it has no business logic or authorization.
 * All methods are read-only.
 */
export interface IAiDataRepository {
  getBrandRules(calendarId: string): Promise<BrandRule[]>
  getPosts(calendarId: string): Promise<Post[]>
  getPost(postId: string): Promise<Post | null>
  getMediaByCalendar(calendarId: string): Promise<MediaItem[]>
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

  async getPosts(calendarId: string): Promise<Post[]> {
    try {
      return await dbGetPosts(calendarId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching posts for calendar ${calendarId}:`, error)
      return []
    }
  }

  async getPost(postId: string): Promise<Post | null> {
    try {
      return await dbGetPostById(postId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching post ${postId}:`, error)
      return null
    }
  }

  async getMediaByCalendar(calendarId: string): Promise<MediaItem[]> {
    try {
      return await dbGetMediaByCalendar(calendarId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching media for calendar ${calendarId}:`, error)
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