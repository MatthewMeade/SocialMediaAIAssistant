import { createClient } from "../supabase/server"
import type { Post } from "../../../shared/types"

export async function getPosts(calendarId: string): Promise<Post[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("calendar_id", calendarId)
    .order("date", { ascending: true })

  if (error) {
    console.error("[v0] Error loading posts:", error)
    return []
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    calendarId: p.calendar_id,
    date: new Date(p.date),
    caption: p.caption,
    images: p.images || [],
    platform: p.platform,
    status: p.status,
    authorId: p.author_id,
    authorName: p.author_name,
    comments: [], // Comments will be loaded separately if needed
  }))
}

export async function savePost(post: Omit<Post, "id"> & { id?: string }): Promise<Post | null> {
  const supabase = await createClient()

  const postData: any = {
    calendar_id: post.calendarId,
    date: post.date.toISOString(),
    caption: post.caption,
    images: post.images,
    platform: post.platform,
    status: post.status,
    author_id: post.authorId,
    author_name: post.authorName,
  }

  if (post.id) {
    // Update existing post
    const { data, error } = await supabase.from("posts").update(postData).eq("id", post.id).select().single()

    if (error) {
      console.error("[v0] Error updating post:", error)
      return null
    }

    return {
      id: data.id,
      calendarId: data.calendar_id,
      date: new Date(data.date),
      caption: data.caption,
      images: data.images || [],
      platform: data.platform,
      status: data.status,
      authorId: data.author_id,
      authorName: data.author_name,
      comments: post.comments || [],
    }
  } else {
    // Create new post
    const { data, error } = await supabase.from("posts").insert(postData).select().single()

    if (error) {
      console.error("[v0] Error creating post:", error)
      return null
    }

    return {
      id: data.id,
      calendarId: data.calendar_id,
      date: new Date(data.date),
      caption: data.caption,
      images: data.images || [],
      platform: data.platform,
      status: data.status,
      authorId: data.author_id,
      authorName: data.author_name,
      comments: [],
    }
  }
}

export async function deletePost(postId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase.from("posts").delete().eq("id", postId)

  if (error) {
    console.error("[v0] Error deleting post:", error)
    return false
  }

  return true
}
