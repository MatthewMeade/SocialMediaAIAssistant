// server/ai-service/services/image-generation-service.ts

import type { DallEAPIWrapper } from '@langchain/openai'

import { supabase } from '../../lib/supabase'

import { saveMedia } from '../../lib/db/media'

import type { MediaItem } from '../../../shared/types'
import { langfuseHandler } from '../../../server/lib/langfuse'

/**
 * Generates an image, downloads it, and uploads it to Supabase storage.
 * @returns The new MediaItem record.
 */
export async function generateAndStoreImage(
  prompt: string,
  calendarId: string,
  userId: string,
  imageGenerator: DallEAPIWrapper,
): Promise<MediaItem> {
  // 1. Generate Image with LangChain Wrapper
  console.log(
    `[AI_IMAGE_GEN_LC] Starting DALL-E 3 generation for: "${prompt.substring(
      0,
      50,
    )}..."`,
  )

  const tempImageUrl = await imageGenerator.invoke(prompt, { callbacks: [langfuseHandler] })

  if (!tempImageUrl) {
    throw new Error('Image generation failed (no URL returned).')
  }
  console.log(`[AI_IMAGE_GEN_LC] Image generated, temporary URL: ${tempImageUrl}`)

  // 2. Download the image from the temporary URL
  const imageResponse = await fetch(tempImageUrl)
  if (!imageResponse.ok) {
    throw new Error('Failed to download generated image from OpenAI.')
  }
  const imageArrayBuffer = await imageResponse.arrayBuffer()
  const imageType = imageResponse.headers.get('content-type') || 'image/png'
  const fileExtension = imageType.split('/')[1] || 'png'

  // 3. Convert ArrayBuffer to Buffer for Supabase storage upload (Node.js compatible)
  const imageBuffer = Buffer.from(imageArrayBuffer)

  // 4. Upload the image buffer to your Supabase Storage
  const filename = `gen_${Date.now()}.${fileExtension}`
  const filePath = `${calendarId}/${filename}` // Store images in a folder per calendar

  console.log(`[AI_IMAGE_GEN_LC] Uploading to Supabase storage at: ${filePath}`)
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media') // Assumes your bucket is named 'media'
    .upload(filePath, imageBuffer, {
      contentType: imageType,
      upsert: false,
    })

  if (uploadError) {
    console.error('[AI_IMAGE_GEN_LC] Supabase upload error:', uploadError)
    console.error('[AI_IMAGE_GEN_LC] Upload error details:', JSON.stringify(uploadError, null, 2))
    throw new Error(`Failed to upload image to storage: ${uploadError.message || 'Unknown error'}`)
  }

  // 5. Get the public URL for the newly uploaded file
  const { data: publicUrlData } = supabase.storage
    .from('media')
    .getPublicUrl(uploadData.path)

  const publicUrl = publicUrlData.publicUrl
  console.log(`[AI_IMAGE_GEN_LC] File stored at public URL: ${publicUrl}`)

  // 6. Save the metadata to your 'media' database table
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

  // Map to shared MediaItem type (excludes userId)
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

