import { useState, useEffect } from "react"
import { Upload, X, ChevronLeft, ChevronRight, ImageIcon, Sparkles } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { apiGet, apiPost } from "@/lib/api-client"
import type { Post, MediaItem } from "@/lib/types"
import { ImageGeneratorPanel } from "@/components/ai/image-generator-panel"

interface PostImageGalleryProps {
  post: Post
  onUpdate: (updates: Partial<Post>) => void
}

export function PostImageGallery({ post, onUpdate }: PostImageGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [showImageGenerator, setShowImageGenerator] = useState(false)
  const [libraryMedia, setLibraryMedia] = useState<any[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)

  useEffect(() => {
    if (showMediaPicker && libraryMedia.length === 0) {
      loadLibraryMedia()
    }
  }, [showMediaPicker])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("calendarId", post.calendarId)

        const data = await apiPost<{ url: string }>("/api/upload", formData)
        uploadedUrls.push(data.url)
      }

      onUpdate({ images: [...post.images, ...uploadedUrls] })
    } catch (error) {
      console.error("[v0] Error uploading images:", error)
      alert("Failed to upload images. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    const newImages = post.images.filter((_, i) => i !== index)
    onUpdate({ images: newImages })
    if (currentImageIndex >= newImages.length && newImages.length > 0) {
      setCurrentImageIndex(newImages.length - 1)
    }
  }

  const loadLibraryMedia = async () => {
    setIsLoadingLibrary(true)
    try {
      const calendarId = post.calendarId
      if (!calendarId) return

      try {
        const data = await apiGet<Array<{ id: string; url: string; filename: string }>>(
          `/api/media?calendarId=${calendarId}`,
        )
        setLibraryMedia(data)
      } catch (error) {
        console.error("[v0] Error loading library media:", error)
      }
    } catch (error) {
      console.error("[v0] Error loading library media:", error)
    } finally {
      setIsLoadingLibrary(false)
    }
  }

  const handleSelectFromLibrary = (url: string) => {
    onUpdate({ images: [...post.images, url] })
    setShowMediaPicker(false)
  }

  const handleImageGenerated = (mediaItem: MediaItem) => {
    onUpdate({ images: [...post.images, mediaItem.url] })
    setShowImageGenerator(false)
  }

  return (
    <>
      <div className="space-y-3">
        <Label>Images</Label>

        {post.images.length > 0 && (
          <div className="relative w-full aspect-video rounded-lg border border-border overflow-hidden bg-muted">
            <img
              src={post.images[currentImageIndex] || "/placeholder.svg"}
              alt={`Image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
            {post.images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentImageIndex((prev) => (prev === 0 ? post.images.length - 1 : prev - 1))
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    setCurrentImageIndex((prev) => (prev === post.images.length - 1 ? 0 : prev + 1))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur-sm">
                  {currentImageIndex + 1} / {post.images.length}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {post.images.map((image, index) => (
            <div
              key={index}
              className={cn(
                "group relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                currentImageIndex === index ? "border-primary" : "border-border hover:border-primary/50",
              )}
              onClick={() => setCurrentImageIndex(index)}
            >
              <img
                src={image || "/placeholder.svg"}
                alt={`Thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveImage(index)
                }}
                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {post.images.length === 0 ? (
            <div className="flex gap-2 w-full">
              <label className="flex flex-1 h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50">
                {isUploading ? (
                  <>
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2" />
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Upload new</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              <button
                onClick={() => setShowMediaPicker(true)}
                className="flex flex-1 h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Choose from library</span>
              </button>
              <button
                onClick={() => setShowImageGenerator(true)}
                className="flex flex-1 h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
              >
                <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Generate with AI</span>
              </button>
            </div>
          ) : (
            <>
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50">
                {isUploading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              <button
                onClick={() => setShowMediaPicker(true)}
                className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
              >
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setShowImageGenerator(true)}
                className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </button>
            </>
          )}
        </div>
      </div>

      {showMediaPicker && (
        <MediaLibraryDialog
          isOpen={showMediaPicker}
          onClose={() => setShowMediaPicker(false)}
          onSelect={handleSelectFromLibrary}
          libraryMedia={libraryMedia}
          isLoadingLibrary={isLoadingLibrary}
        />
      )}

      {showImageGenerator && (
        <ImageGeneratorPanel
          isOpen={showImageGenerator}
          onClose={() => setShowImageGenerator(false)}
          onImageGenerated={handleImageGenerated}
          calendarId={post.calendarId}
          postCaption={post.caption}
        />
      )}
    </>
  )
}

function MediaLibraryDialog({
  isOpen,
  onClose,
  onSelect,
  libraryMedia,
  isLoadingLibrary,
}: {
  isOpen: boolean
  onClose: () => void
  onSelect: (url: string) => void
  libraryMedia: any[]
  isLoadingLibrary: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose from Library</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[60vh] py-4">
          {isLoadingLibrary ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : libraryMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No media in library yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload files to see them here</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-3 md:grid-cols-4">
              {libraryMedia.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.url)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-accent hover:shadow-lg transition-all hover:border-primary"
                >
                  <img
                    src={item.url || "/placeholder.svg"}
                    alt={item.filename}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Select</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

