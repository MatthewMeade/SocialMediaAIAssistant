import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { BaseEditor, createEditor, Descendant, Editor, Element as SlateElement, Transforms } from "slate"
import {
  Slate,
  Editable,
  withReact,
  RenderLeafProps,
  RenderElementProps,
  ReactEditor,
  useSlate,
} from "slate-react"
import { HistoryEditor, withHistory } from "slate-history"
import { Bold, Italic, Underline, List, ListOrdered, Quote, Heading1, Heading2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CustomElement =
  | { type: "paragraph"; children: CustomText[] }
  | { type: "heading-one"; children: CustomText[] }
  | { type: "heading-two"; children: CustomText[] }
  | { type: "block-quote"; children: CustomText[] }
  | { type: "numbered-list"; children: CustomElement[] }
  | { type: "bulleted-list"; children: CustomElement[] }
  | { type: "list-item"; children: CustomText[] }

type CustomText = { text: string; bold?: boolean; italic?: boolean; underline?: boolean }
type CustomEditor = BaseEditor & HistoryEditor & ReactEditor

declare module "slate" {
  interface CustomTypes {
    Editor: CustomEditor
    Element: CustomElement
    Text: CustomText
  }
}

const LIST_TYPES = ["numbered-list", "bulleted-list"]

interface SlateEditorProps {
  value?: Descendant[] // Slate JSON content (optional)
  onChange: (value: Descendant[]) => void
  placeholder?: string
  className?: string
}

const DEFAULT_SLATE_VALUE: Descendant[] = [
  { type: "paragraph" as const, children: [{ text: "" }] },
]

function normalizeSlateContent(content: any): Descendant[] {
  const createEmptyValue = (): CustomElement[] => [
    { type: "paragraph" as const, children: [{ text: "" }] },
  ]

  if (!content) {
    return createEmptyValue() as Descendant[]
  }

  if (Array.isArray(content) && content.length > 0) {
    const isValid = content.every(
      (node) =>
        node &&
        typeof node === "object" &&
        "type" in node &&
        Array.isArray((node as any).children),
    )

    if (isValid) {
      return content as Descendant[]
    }
  }

  if (typeof content === "string") {
    const lines = content.split("\n")
    return lines.length > 0
      ? (lines.map((line) => ({
          type: "paragraph" as const,
          children: [{ text: line }],
        })) as CustomElement[])
      : (createEmptyValue() as Descendant[])
  }

  return createEmptyValue() as Descendant[]
}

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>
  }
  if (leaf.italic) {
    children = <em>{children}</em>
  }
  if (leaf.underline) {
    children = <u>{children}</u>
  }

  return <span {...attributes}>{children}</span>
}

const Element = ({ attributes, children, element }: RenderElementProps) => {
  switch (element.type) {
    case "block-quote":
      return (
        <blockquote className="border-l-4 border-muted-foreground pl-4 my-4 italic" {...attributes}>
          {children}
        </blockquote>
      )
    case "bulleted-list":
      return (
        <ul className="list-disc pl-6 my-2" {...attributes}>
          {children}
        </ul>
      )
    case "heading-one":
      return (
        <h1 className="text-3xl font-bold my-4" {...attributes}>
          {children}
        </h1>
      )
    case "heading-two":
      return (
        <h2 className="text-2xl font-semibold my-3" {...attributes}>
          {children}
        </h2>
      )
    case "list-item":
      return (
        <li className="my-1" {...attributes}>
          {children}
        </li>
      )
    case "numbered-list":
      return (
        <ol className="list-decimal pl-6 my-2" {...attributes}>
          {children}
        </ol>
      )
    default:
      return (
        <p className="my-2" {...attributes}>
          {children}
        </p>
      )
  }
}

function normalizeEditor(editor: CustomEditor) {
  const { selection } = editor
  
  if (selection) {
    try {
      const anchorPath = selection.anchor.path
      if (anchorPath[0] >= editor.children.length) {
        const end = Editor.end(editor, [])
        Transforms.select(editor, end)
        return
      }
      
      const node = Editor.node(editor, anchorPath)
      if (!node) {
        const end = Editor.end(editor, [])
        Transforms.select(editor, end)
      }
    } catch {
      try {
        if (editor.children.length > 0) {
          const end = Editor.end(editor, [])
          Transforms.select(editor, end)
        } else {
          Transforms.deselect(editor)
        }
      } catch {
        Transforms.deselect(editor)
      }
    }
  }
}

export function SlateEditor({ value, onChange, placeholder = "Start writing...", className }: SlateEditorProps) {
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()))
    const { normalizeNode } = e
    e.normalizeNode = (entry) => {
      const [node, path] = entry
      
      if (SlateElement.isElement(node) && node.children.length === 0) {
        Transforms.removeNodes(e, { at: path })
        return
      }
      
      normalizeNode(entry)
    }
    return e
  }, [])
  const isInternalChangeRef = useRef(false)

  const [internalValue, setInternalValue] = useState<Descendant[]>(() => normalizeSlateContent(value))

  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }

    const normalized = normalizeSlateContent(value)
    const currentKey = JSON.stringify(editor.children)
    const newKey = JSON.stringify(normalized)
    
    if (currentKey !== newKey) {
      const timeoutId = setTimeout(() => {
        try {
          const childrenLength = editor.children.length
          for (let i = childrenLength - 1; i >= 0; i--) {
            Transforms.removeNodes(editor, { at: [i] })
          }
          
          if (normalized.length > 0) {
            Transforms.insertNodes(editor, normalized, { at: [0] })
          } else {
            Transforms.insertNodes(editor, DEFAULT_SLATE_VALUE, { at: [0] })
          }
          
          normalizeEditor(editor)
          editor.onChange()
          setInternalValue(normalized.length > 0 ? normalized : DEFAULT_SLATE_VALUE)
        } catch (error) {
          console.error("Error updating editor:", error)
          try {
            const childrenLength = editor.children.length
            for (let i = childrenLength - 1; i >= 0; i--) {
              Transforms.removeNodes(editor, { at: [i] })
            }
            Transforms.insertNodes(editor, DEFAULT_SLATE_VALUE, { at: [0] })
            normalizeEditor(editor)
            editor.onChange()
          } catch (error) {
            console.debug('Error resetting editor:', error)
          }
          setInternalValue(DEFAULT_SLATE_VALUE)
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [value, editor])

  const handleChange = useCallback(
    (newValue: Descendant[]) => {
      try {
        const safeValue =
          Array.isArray(newValue) && newValue.length > 0 ? (newValue as Descendant[]) : DEFAULT_SLATE_VALUE

        normalizeEditor(editor)

        isInternalChangeRef.current = true
        setInternalValue(safeValue)
        onChange(safeValue)
      } catch (error) {
        console.error("Error in handleChange:", error)
        const safeValue = DEFAULT_SLATE_VALUE
        try {
          Transforms.removeNodes(editor, { at: [0] })
          Transforms.insertNodes(editor, safeValue, { at: [0] })
          normalizeEditor(editor)
        } catch (error) {
          console.debug('Error recovering editor:', error)
        }
        isInternalChangeRef.current = true
        setInternalValue(safeValue)
        onChange(safeValue)
      }
    },
    [onChange, editor],
  )

  return (
    <div className={cn("border rounded-lg flex flex-col w-full", className)} style={{ minHeight: '900px' }}>
      <Slate editor={editor} initialValue={internalValue} onChange={handleChange}>
        <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-shrink-0 min-h-[40px]">
          <ToolbarButtons />
        </div>

        <div className="flex-1 min-h-0" style={{ minHeight: '860px' }}>
          <Editable
            renderLeaf={Leaf}
            renderElement={Element}
            placeholder={placeholder}
            className="p-4 focus:outline-none prose prose-sm max-w-none h-full slate-editor"
            style={{
              fontSize: "16px",
              lineHeight: "1.6",
              minHeight: '860px',
            }}
          />
        </div>
      </Slate>
    </div>
  )
}

function ToolbarButtons() {
  const editor = useSlate()
  
  const toggleMark = useCallback(
    (format: "bold" | "italic" | "underline") => {
      const isActive = isMarkActive(editor, format)
      if (isActive) {
        Editor.removeMark(editor, format)
      } else {
        Editor.addMark(editor, format, true)
      }
    },
    [editor],
  )

  const toggleBlock = useCallback(
    (format: string) => {
      const isActive = isBlockActive(editor, format)
      const isList = LIST_TYPES.includes(format)

      Transforms.unwrapNodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) &&
          SlateElement.isElement(n) &&
          LIST_TYPES.includes(n.type),
        split: true,
      })

      let newProperties: Partial<CustomElement>
      if (isList) {
        newProperties = {
          type: isActive ? "paragraph" : "list-item",
        } as Partial<CustomElement>
      } else {
        newProperties = {
          type: isActive ? "paragraph" : format,
        } as Partial<CustomElement>
      }

      Transforms.setNodes(editor, newProperties)

      if (!isActive && isList) {
        const block = { type: format, children: [] } as CustomElement
        Transforms.wrapNodes(editor, block)
      }
    },
    [editor],
  )

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <div className="flex items-center gap-1 border-r pr-1 mr-1">
        <FormatButton
          icon={<Bold className="h-4 w-4" />}
          isActive={isMarkActive(editor, "bold")}
          onToggle={() => toggleMark("bold")}
        />
        <FormatButton
          icon={<Italic className="h-4 w-4" />}
          isActive={isMarkActive(editor, "italic")}
          onToggle={() => toggleMark("italic")}
        />
        <FormatButton
          icon={<Underline className="h-4 w-4" />}
          isActive={isMarkActive(editor, "underline")}
          onToggle={() => toggleMark("underline")}
        />
      </div>

      <div className="flex items-center gap-1 border-r pr-1 mr-1">
        <BlockButton
          format="heading-one"
          icon={<Heading1 className="h-4 w-4" />}
          isActive={isBlockActive(editor, "heading-one")}
          onToggle={() => toggleBlock("heading-one")}
        />
        <BlockButton
          format="heading-two"
          icon={<Heading2 className="h-4 w-4" />}
          isActive={isBlockActive(editor, "heading-two")}
          onToggle={() => toggleBlock("heading-two")}
        />
      </div>

      <div className="flex items-center gap-1 border-r pr-1 mr-1">
        <BlockButton
          format="bulleted-list"
          icon={<List className="h-4 w-4" />}
          isActive={isBlockActive(editor, "bulleted-list")}
          onToggle={() => toggleBlock("bulleted-list")}
        />
        <BlockButton
          format="numbered-list"
          icon={<ListOrdered className="h-4 w-4" />}
          isActive={isBlockActive(editor, "numbered-list")}
          onToggle={() => toggleBlock("numbered-list")}
        />
      </div>

      <BlockButton
        format="block-quote"
        icon={<Quote className="h-4 w-4" />}
        isActive={isBlockActive(editor, "block-quote")}
        onToggle={() => toggleBlock("block-quote")}
      />
    </div>
  )
}

function FormatButton({
  icon,
  isActive,
  onToggle,
}: {
  icon: React.ReactNode
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onMouseDown={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className="h-8 w-8 p-0"
    >
      {icon}
    </Button>
  )
}

function isMarkActive(editor: Editor, format: string): boolean {
  const marks = Editor.marks(editor)
  return marks ? marks[format as keyof typeof marks] === true : false
}

function isBlockActive(editor: Editor, format: string): boolean {
  const { selection } = editor
  if (!selection) return false

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) => {
        if (!Editor.isEditor(n) && SlateElement.isElement(n)) {
          return (n as CustomElement).type === format
        }
        return false
      },
    })
  )

  return !!match
}

function BlockButton({
  format: _format,
  icon,
  isActive,
  onToggle,
}: {
  format: string
  icon: React.ReactNode
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onMouseDown={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className="h-8 w-8 p-0"
    >
      {icon}
    </Button>
  )
}

