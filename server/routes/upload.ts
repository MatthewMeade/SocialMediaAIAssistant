import { Hono } from 'hono'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser, canAccessCalendar } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { saveMedia } from '../lib/db/media'

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

// Middleware to load and validate user
app.use('*', requireAuth)

/**
 * Upload endpoint for files
 * Accepts multipart/form-data with:
 * - file: The file to upload
 * - calendarId: The calendar ID to associate the file with (required)
 */
app.post('/', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  try {
    // Parse multipart form data
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const calendarId = formData.get('calendarId') as string | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // calendarId is required to ensure all files are tracked in the database
    if (!calendarId) {
      return c.json({ error: 'calendarId is required' }, 400)
    }

    // Verify user has access to the calendar
    const hasAccess = await canAccessCalendar(user.id, calendarId)
    if (!hasAccess) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Convert File to Buffer for Supabase storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    // Use calendarId-based path structure
    const filePath = `${calendarId}/${filename}`

    console.log(`[UPLOAD] Uploading file to Supabase storage at: ${filePath}`)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[UPLOAD] Supabase upload error:', uploadError)
      console.error('[UPLOAD] Upload error details:', JSON.stringify(uploadError, null, 2))
      return c.json(
        { error: 'Failed to upload file to storage', details: uploadError.message },
        500,
      )
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(uploadData.path)

    const publicUrl = publicUrlData.publicUrl
    console.log(`[UPLOAD] File stored at public URL: ${publicUrl}`)

    // Save metadata to database - calendarId is guaranteed to exist at this point
    const mediaItem = await saveMedia(
      calendarId,
      user.id,
      publicUrl,
      filename,
      buffer.length,
      file.type,
    )

    if (!mediaItem) {
      console.error('[UPLOAD] Failed to save media metadata')
      // Still return the URL even if metadata save fails, but log the error
    }

    return c.json({ url: publicUrl })
  } catch (error: any) {
    console.error('[UPLOAD] Error processing upload:', error)
    return c.json(
      { error: 'Failed to process upload', details: error.message },
      500,
    )
  }
})

export default app

