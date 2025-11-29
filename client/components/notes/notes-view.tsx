import type React from "react"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Plus, Trash2, FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useNotes } from "@/lib/hooks/use-notes"
import type { Note } from "@/lib/types"
import { format } from "date-fns"
import { SlateEditor } from "./slate-editor"
import { useAppContext } from "../layout/app-layout"

interface NotesViewProps {
  calendarId: string
}

export function NotesView({ calendarId }: NotesViewProps) {
  const { notes, isLoading, createNote, updateNote, deleteNote } = useNotes(calendarId)
  const { setClientContext } = useAppContext()
  
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [content, setContent] = useState<any>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return notes
    return notes.filter((note) => note.title.toLowerCase().includes(query))
  }, [notes, searchQuery])

  const activeNote = useMemo(() => {
    if (!selectedNoteId) return null
    return notes.find((note) => note.id === selectedNoteId) ?? null
  }, [notes, selectedNoteId])

  useEffect(() => {
    if (!notes.length) {
      setSelectedNoteId(null)
      return
    }
    if (!selectedNoteId || !notes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(notes[0].id)
    }
  }, [notes, selectedNoteId])

  useEffect(() => {
    if (selectedNoteId) {
      setClientContext("notes", { noteId: selectedNoteId })
    } else {
      setClientContext("notes", {})
    }
  }, [selectedNoteId, setClientContext])

  useEffect(() => {
    if (!activeNote) {
      setTitle("")
      setContent(null)
      return
    }
    setTitle(activeNote.title)
    setContent(activeNote.content || null)
  }, [activeNote])

  const debouncedSave = useCallback(
    (slateContent: any) => {
      if (!selectedNoteId) return

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true)
        try {
          const currentNote = notes.find((n: Note) => n.id === selectedNoteId)
          await updateNote.mutateAsync({
            id: selectedNoteId,
            title: title || currentNote?.title || "Untitled Note",
            content: slateContent,
          })
        } catch (error) {
          console.error("Error auto-saving note:", error)
        } finally {
          setIsSaving(false)
        }
      }, 1000)
    },
    [selectedNoteId, title, notes, updateNote],
  )

  const handleContentChange = useCallback((slateContent: any) => {
    setContent(slateContent)
    debouncedSave(slateContent)
  }, [debouncedSave])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedNoteId || !activeNote) return

    const titleChanged = title !== activeNote.title
    const contentChanged =
      JSON.stringify(content ?? null) !== JSON.stringify(activeNote.content ?? null)

    if (!titleChanged && !contentChanged) return

    const timeoutId = setTimeout(async () => {
      setIsSaving(true)
      try {
        await updateNote.mutateAsync({
          id: selectedNoteId,
          title: title || "Untitled Note",
          content: content ?? null,
        })
      } catch (error) {
        console.error("Error saving note:", error)
      } finally {
        setIsSaving(false)
      }
    }, 600)

    return () => clearTimeout(timeoutId)
  }, [title, content, selectedNoteId, activeNote, updateNote])

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote.mutateAsync({
        title: "Untitled Note",
        content: null,
      })
      setSelectedNoteId(newNote.id)
      setTitle(newNote.title)
      setContent(newNote.content || null)
    } catch (error) {
      console.error("Error creating note:", error)
    }
  }

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Are you sure you want to delete this note?")) {
      try {
        await deleteNote.mutateAsync(noteId)
        if (selectedNoteId === noteId) {
          setSelectedNoteId(null)
          setTitle("")
          setContent(null)
        }
      } catch (error) {
        console.error("Error deleting note:", error)
      }
    }
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center">Loading notes...</div>
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Notes</h2>
            <Button size="sm" onClick={handleCreateNote}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery ? "No notes found" : "No notes yet"}
            </div>
          ) : (
            <div className="p-2">
              {filteredNotes.map((note: Note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`
                    group relative mb-1 rounded-lg p-3 cursor-pointer transition-colors
                    ${
                      selectedNoteId === note.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent"
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 shrink-0" />
                        <h3 className="font-medium truncate">{note.title}</h3>
                      </div>
                      <p className="text-xs opacity-70 line-clamp-2">
                        {format(new Date(note.updatedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => handleDeleteNote(note.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Editor Area - Fixed height to prevent resizing */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedNoteId ? (
          <>
            {/* Title Bar - Fixed height, no resizing */}
            <div className="border-b border-border p-4 flex-shrink-0" style={{ height: '80px' }}>
              <div className="h-10 flex items-center">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled Note"
                  className="text-2xl font-semibold border-0 focus-visible:ring-0 px-0 h-full"
                />
              </div>
              {/* Always reserve space for saving indicator */}
              <div className="h-5 flex items-start mt-1">
                {isSaving && (
                  <p className="text-xs text-muted-foreground">Saving...</p>
                )}
              </div>
            </div>

            {/* Slate Editor - Fixed height container, full width */}
            <div className="flex-1 overflow-hidden min-h-0">
              <div className="h-full overflow-y-auto px-8 pb-8">
                <SlateEditor
                  value={content}
                  onChange={handleContentChange}
                  placeholder="Start writing your note..."
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-2">Select a note to start editing</h2>
              <p className="text-muted-foreground mb-4">Or create a new note to get started</p>
              <Button onClick={handleCreateNote}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
