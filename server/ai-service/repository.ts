import type { BrandRule, Post, MediaItem, Note } from '../../shared/types'
import { getBrandRules as dbGetBrandRules } from '../lib/db/brand-voice'
import { getPosts as dbGetPosts, getPostById as dbGetPostById } from '../lib/db/posts'
import { getMediaByCalendar as dbGetMediaByCalendar } from '../lib/db/media'
import { getNoteById as dbGetNoteById } from '../lib/db/notes'
import { canAccessCalendar } from '../lib/auth'

/**
 * Interface for the AI service to fetch data.
 * This allows swapping between local DB calls and remote API calls.
 * 
 * The repository handles authorization internally. For local implementations,
 * it checks access before returning data. For API implementations, it passes
 * user context to the downstream service which handles auth.
 * 
 * All methods are read-only.
 */
export interface IAiDataRepository {
  getBrandRules(): Promise<BrandRule[]>
  getPosts(): Promise<Post[]>
  getPost(postId: string): Promise<Post | null>
  getNote(noteId: string): Promise<Note | null>
  getMediaByCalendar(): Promise<MediaItem[]>
}

/**
 * Local implementation that calls the database directly.
 * Handles authorization checks internally before fetching data.
 */
export class LocalDataRepository implements IAiDataRepository {
  private userId: string
  private calendarId: string

  constructor(userId: string, calendarId: string) {
    this.userId = userId
    this.calendarId = calendarId
  }

  /**
   * Verifies the user has access to the calendar.
   * Throws an error if access is denied.
   */
  private async verifyAccess(): Promise<void> {
    const hasAccess = await canAccessCalendar(this.userId, this.calendarId)
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }
  }

  async getBrandRules(): Promise<BrandRule[]> {
    try {
      await this.verifyAccess()
      return await dbGetBrandRules(this.calendarId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching brand rules for calendar ${this.calendarId}:`, error)
      throw error
    }
  }

  async getPosts(): Promise<Post[]> {
    try {
      await this.verifyAccess()
      return await dbGetPosts(this.calendarId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching posts for calendar ${this.calendarId}:`, error)
      throw error
    }
  }

  async getPost(postId: string): Promise<Post | null> {
    try {
      await this.verifyAccess()
      const post = await dbGetPostById(postId)

      // Verify the post belongs to this calendar
      if (post && post.calendarId !== this.calendarId) {
        return null
      }

      return post
    } catch (error) {
      console.error(`[AI_REPO] Error fetching post ${postId}:`, error)
      throw error
    }
  }

  async getMediaByCalendar(): Promise<MediaItem[]> {
    try {
      await this.verifyAccess()
      return await dbGetMediaByCalendar(this.calendarId)
    } catch (error) {
      console.error(`[AI_REPO] Error fetching media for calendar ${this.calendarId}:`, error)
      throw error
    }
  }

  async getNote(noteId: string): Promise<Note | null> {
    try {
      await this.verifyAccess()
      const note = await dbGetNoteById(noteId)

      // Verify the note belongs to this calendar
      if (note && note.calendarId !== this.calendarId) {
        return null
      }

      return note
    } catch (error) {
      console.error(`[AI_REPO] Error fetching note ${noteId}:`, error)
      throw error
    }
  }
}

// (For the future, a remote implementation would look like this)
/*
export class ApiDataRepository implements IAiDataRepository {
  private baseUrl: string;
  private userId: string;
  private calendarId: string;
  private apiToken: string; // Service-to-service token

  constructor(userId: string, calendarId: string, baseUrl: string, apiToken: string) {
    this.userId = userId;
    this.calendarId = calendarId;
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
  }

  async getBrandRules(): Promise<BrandRule[]> {
    // The downstream API handles auth based on userId and calendarId
    const response = await fetch(`${this.baseUrl}/api/brand-voice?calendarId=${this.calendarId}`, {
      headers: { 
        'Authorization': `Bearer ${this.apiToken}`,
        'X-User-Id': this.userId,
        'X-Calendar-Id': this.calendarId
      }
    });
    if (!response.ok) throw new Error('Failed to fetch brand rules');
    return response.json();
  }
}
*/