import type { DallEAPIWrapper } from '@langchain/openai'
import { supabase } from '../../lib/supabase'
import { saveMedia } from '../../lib/db/media'
import type { MediaItem } from '../../../shared/types'
import { langfuseHandler } from '../../../server/lib/langfuse'

export async function generateAndStoreImage(
  prompt: string,
  calendarId: string,
  userId: string,
  imageGenerator: DallEAPIWrapper,
): Promise<MediaItem> {
  const tempImageUrl = await imageGenerator.invoke(prompt, { callbacks: [langfuseHandler] })

  if (!tempImageUrl) {
    throw new Error('Image generation failed (no URL returned).')
  }

  const imageResponse = await fetch(tempImageUrl)
  if (!imageResponse.ok) {
    throw new Error('Failed to download generated image from OpenAI.')
  }
  const imageArrayBuffer = await imageResponse.arrayBuffer()
  const imageType = imageResponse.headers.get('content-type') || 'image/png'
  const fileExtension = imageType.split('/')[1] || 'png'

  const imageBuffer = Buffer.from(imageArrayBuffer)

  const filename = `gen_${Date.now()}.${fileExtension}`
  const filePath = `${calendarId}/${filename}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, imageBuffer, {
      contentType: imageType,
      upsert: false,
    })

  if (uploadError) {
    console.error('[AI_IMAGE_GEN_LC] Supabase upload error:', uploadError)
    throw new Error(`Failed to upload image to storage: ${uploadError.message || 'Unknown error'}`)
  }

  const { data: publicUrlData } = supabase.storage
    .from('media')
    .getPublicUrl(uploadData.path)

  const publicUrl = publicUrlData.publicUrl

  const newMediaItem = await saveMedia(
    calendarId,
    userId,
    publicUrl,
    filename,
    imageBuffer.length,
    imageType,
  )

  if (!newMediaItem) {
    throw new Error('Failed to save media metadata to database.')
  }

  return {
    id: newMediaItem.id,
    calendarId: newMediaItem.calendarId,
    url: newMediaItem.url,
    filename: newMediaItem.filename,
    size: newMediaItem.size,
    type: newMediaItem.type,
    createdAt: newMediaItem.createdAt,
  } as MediaItem
}

