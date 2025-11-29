import { Hono } from 'hono'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser, canAccessCalendar } from '../lib/auth'
import { getMediaByCalendar, deleteMedia } from '../lib/db/media'
import type { MediaItem } from '../../shared/types'

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

app.use('*', requireAuth)

app.get('/', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const calendarId = c.req.query('calendarId')

  if (!calendarId) {
    return c.json({ error: 'calendarId is required' }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const mediaItems = await getMediaByCalendar(calendarId)
    
    const response: MediaItem[] = mediaItems.map((item) => ({
      id: item.id,
      calendarId: item.calendarId,
      url: item.url,
      filename: item.filename,
      size: item.size,
      type: item.type,
      createdAt: item.createdAt,
    }))

    return c.json(response)
  } catch (error: any) {
    console.error('[MEDIA] Error fetching media:', error)
    return c.json({ error: 'Failed to fetch media', details: error.message }, 500)
  }
})

app.delete('/', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const mediaId = c.req.query('id')

  if (!mediaId) {
    return c.json({ error: 'id is required' }, 400)
  }

  try {
    const success = await deleteMedia(mediaId)
    
    if (!success) {
      return c.json({ error: 'Failed to delete media' }, 500)
    }

    return c.json({ success: true })
  } catch (error: any) {
    console.error('[MEDIA] Error deleting media:', error)
    return c.json({ error: 'Failed to delete media', details: error.message }, 500)
  }
})

export default app

