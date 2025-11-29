import { Hono } from 'hono'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser, canAccessCalendar } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { saveMedia } from '../lib/db/media'

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

app.use('*', requireAuth)

app.post('/', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const calendarId = formData.get('calendarId') as string | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (!calendarId) {
      return c.json({ error: 'calendarId is required' }, 400)
    }

    const hasAccess = await canAccessCalendar(user.id, calendarId)
    if (!hasAccess) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = `${calendarId}/${filename}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return c.json(
        { error: 'Failed to upload file to storage', details: uploadError.message },
        500,
      )
    }

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(uploadData.path)

    const publicUrl = publicUrlData.publicUrl

    const mediaItem = await saveMedia(
      calendarId,
      user.id,
      publicUrl,
      filename,
      buffer.length,
      file.type,
    )

    if (!mediaItem) {
      console.error('Failed to save media metadata')
    }

    return c.json({ url: publicUrl })
  } catch (error: any) {
    console.error('Error processing upload:', error)
    return c.json(
      { error: 'Failed to process upload', details: error.message },
      500,
    )
  }
})

export default app

