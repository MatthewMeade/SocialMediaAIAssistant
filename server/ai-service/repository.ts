import type { BrandRule, Post, MediaItem, Note } from '../../shared/types'
import { getBrandRules as dbGetBrandRules } from '../lib/db/brand-voice'
import { getPosts as dbGetPosts, getPostById as dbGetPostById } from '../lib/db/posts'
import { getMediaByCalendar as dbGetMediaByCalendar } from '../lib/db/media'
import { getNoteById as dbGetNoteById } from '../lib/db/notes'
import { canAccessCalendar } from '../lib/auth'

export interface IAiDataRepository {
  getBrandRules(): Promise<BrandRule[]>
  getPosts(): Promise<Post[]>
  getPost(postId: string): Promise<Post | null>
  getNote(noteId: string): Promise<Note | null>
  getMediaByCalendar(): Promise<MediaItem[]>
}

export class LocalDataRepository implements IAiDataRepository {
  private userId: string
  private calendarId: string

  constructor(userId: string, calendarId: string) {
    this.userId = userId
    this.calendarId = calendarId
  }

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