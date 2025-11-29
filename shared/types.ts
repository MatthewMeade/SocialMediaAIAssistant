export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: Date
  ownerId: string
}

export interface Calendar {
  id: string
  name: string
  slug: string
  organizationId: string | null
  color: string
  createdAt: Date
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: "owner" | "admin" | "member"
  joinedAt: Date
}

export interface CalendarMember {
  id: string
  calendarId: string
  userId: string
  role: "admin" | "member"
  joinedAt: Date
}

export interface Post {
  id: string
  calendarId: string
  date: Date
  caption: string
  images: string[]
  platform: "instagram" | "twitter" | "linkedin"
  status: "draft" | "awaiting_approval" | "approved" | "rejected" | "published"
  authorId: string
  authorName: string
  comments: Comment[]
}

export interface User {
  id: string
  name: string
  email: string
}

export interface Comment {
  id: string
  postId: string
  userId: string
  userName: string
  content: string
  createdAt: Date
}

export interface BrandRule {
  id: string
  calendarId: string
  title: string
  description: string
  enabled: boolean
}

export interface BrandScore {
  overall: number
  rules: {
    ruleId: string
    score: number
    feedback: string
  }[]
  suggestions: string[]
}

export interface GeneratedCaption {
  caption: string
  score: BrandScore | null
}

export interface CaptionGenerationResult {
  caption: string
  score: BrandScore | null
}

export interface MediaItem {
  id: string
  calendarId: string
  url: string
  filename: string
  size: number
  type: string
  createdAt: Date
}

export interface Note {
  id: string
  calendarId: string
  title: string
  content: any
  createdAt: Date
  updatedAt: Date
}
