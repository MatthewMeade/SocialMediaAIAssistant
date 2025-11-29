export function normalizeDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date)
}

export function formatDateTimeForInput(date: Date | string): string {
  const dateObj = normalizeDate(date)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getDate()).padStart(2, "0")
  const hours = String(dateObj.getHours()).padStart(2, "0")
  const minutes = String(dateObj.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 50) return "text-yellow-600"
  return "text-red-600"
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-500"
  if (score >= 50) return "bg-yellow-500"
  return "bg-red-500"
}

export function parseDate(dateStr: string): Date {
  const lower = dateStr.toLowerCase().trim()

  const createDateAtNoon = (year: number, month: number, day: number): Date => {
    const date = new Date(year, month, day, 12, 0, 0, 0)
    return date
  }

  if (lower === "today") {
    const today = new Date()
    return createDateAtNoon(today.getFullYear(), today.getMonth(), today.getDate())
  }

  if (lower === "tomorrow") {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return createDateAtNoon(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return createDateAtNoon(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const dayIndex = dayNames.findIndex((day) => lower.includes(day))
  if (dayIndex !== -1) {
    const today = new Date()
    const currentDay = today.getDay()
    let daysUntil = dayIndex - currentDay
    if (daysUntil <= 0) {
      daysUntil += 7 // Next occurrence
    }
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysUntil)
    return createDateAtNoon(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  }

  const today = new Date()
  return createDateAtNoon(today.getFullYear(), today.getMonth(), today.getDate())
}

