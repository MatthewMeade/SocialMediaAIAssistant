import type React from "react"
import { useState } from "react"
import { Upload, Search, Trash2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useMedia } from "@/lib/hooks/use-media"
import { apiPost } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"
import type { MediaItem } from "@/lib/types"

interface LibraryViewProps {
  calendarId: string
}

export function LibraryView({ calendarId }: LibraryViewProps) {
  const { media: mediaItems = [], isLoading, deleteMedia } = useMedia(calendarId)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const filteredItems = mediaItems.filter((item: MediaItem) => {
    const matchesSearch = item.filename.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("calendarId", calendarId)

        await apiPost(ApiRoutes.UPLOAD, formData)
      }
    } catch (error) {
      console.error("[v0] Error uploading files:", error)
      alert("Failed to upload files. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    await deleteMedia.mutateAsync(itemId)
    if (selectedItem?.id === itemId) {
      setSelectedItem(null)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Library</h1>
          <label>
            <Button disabled={isUploading} className="gap-2">
              <Upload className="h-4 w-4" />
              {isUploading ? "Uploading..." : "Upload Media"}
            </Button>
            <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading media...</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? "No media found" : "No media yet. Upload your first file!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredItems.map((item: MediaItem) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-accent hover:shadow-lg transition-all"
              >
                <img src={item.url || "/placeholder.svg"} alt={item.filename} className="h-full w-full object-cover" />

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="w-full">
                    <p className="text-white text-sm font-medium truncate mb-1">{item.filename}</p>
                    <span className="text-white/80 text-xs">{formatFileSize(item.size)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-accent">
                <img
                  src={selectedItem.url || "/placeholder.svg"}
                  alt={selectedItem.filename}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">File name</p>
                  <p className="text-sm text-foreground">{selectedItem.filename}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Size</p>
                    <p className="text-sm text-foreground">{formatFileSize(selectedItem.size)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Uploaded</p>
                    <p className="text-sm text-foreground">{formatDate(selectedItem.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => selectedItem && handleDelete(selectedItem.id)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
