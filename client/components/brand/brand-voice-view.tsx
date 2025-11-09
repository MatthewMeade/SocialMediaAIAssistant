import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Sparkles, RefreshCw } from "lucide-react"
import type { BrandRule, CaptionGenerationResult } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { useBrandRules } from "@/lib/hooks/use-brand-rules"
import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api-client"
import { Spinner } from "@/components/ui/spinner"

interface BrandVoiceViewProps {
  calendarId: string
}

export function BrandVoiceView({ calendarId }: BrandVoiceViewProps) {
  const { brandRules, isLoading, createBrandRule, updateBrandRule, deleteBrandRule } = useBrandRules(calendarId)
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [newRule, setNewRule] = useState({ title: "", description: "" })
  const [showNewRuleForm, setShowNewRuleForm] = useState(false)
  const [generatedCaption, setGeneratedCaption] = useState<string | null>(null)
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleToggleRule = async (ruleId: string) => {
    const rule = brandRules.find((r) => r.id === ruleId)
    if (!rule) return

    const updatedRule = { ...rule, enabled: !rule.enabled }
    await updateBrandRule.mutateAsync(updatedRule)
  }

  const handleDeleteRule = async (ruleId: string) => {
    await deleteBrandRule.mutateAsync(ruleId)
  }

  const handleAddRule = async () => {
    if (newRule.title.trim() && newRule.description.trim()) {
      const rule: Omit<BrandRule, "id"> = {
        calendarId,
        title: newRule.title,
        description: newRule.description,
        enabled: true,
      }
      await createBrandRule.mutateAsync(rule)
      setNewRule({ title: "", description: "" })
      setShowNewRuleForm(false)
    }
  }

  const handleUpdateRule = async (ruleId: string, updates: Partial<BrandRule>) => {
    const rule = brandRules.find((r) => r.id === ruleId)
    if (!rule) return

    const updatedRule = { ...rule, ...updates }
    await updateBrandRule.mutateAsync(updatedRule)
    setEditingRule(null)
  }

  // Mutation for generating captions
  const { mutate: generateCaption } = useMutation({
    mutationFn: async (data: { 
      request: { topic: string; keywords: string[]; tone: string }
      signal: AbortSignal
    }) => {
      return apiPost<CaptionGenerationResult>(
        "/api/ai/generate-caption",
        {
          calendarId,
          request: data.request,
        },
        { signal: data.signal }
      )
    },
    onSuccess: (result) => {
      setGeneratedCaption(result.caption)
      setIsGeneratingCaption(false)
      abortControllerRef.current = null
    },
    onError: (error) => {
      // Don't log errors for aborted requests
      const isAborted = 
        (error instanceof Error && error.name === "AbortError") ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError")
      
      if (!isAborted) {
        console.error("Error generating caption:", error)
      }
      setIsGeneratingCaption(false)
      abortControllerRef.current = null
    },
  })

  const handleGenerateExamplePost = () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsGeneratingCaption(true)
    generateCaption({
      request: {
        topic: "Introducing SocialHub - a new social media management platform that helps teams collaborate and create amazing content",
        keywords: ["social media", "collaboration", "content creation", "teamwork"],
        tone: "professional",
      },
      signal: abortController.signal,
    })
  }

  // Create a dependency string that tracks enabled rules' content
  const enabledRulesKey = useMemo(() => {
    const enabledRules = brandRules.filter((r) => r.enabled)
    // Sort by ID to ensure consistent ordering (important for JSON.stringify comparison)
    const sortedRules = [...enabledRules].sort((a, b) => a.id.localeCompare(b.id))
    return JSON.stringify(
      sortedRules.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        enabled: r.enabled,
      }))
    )
  }, [brandRules])

  // Track the count of enabled rules separately to catch additions/deletions
  const enabledRulesCount = useMemo(() => {
    return brandRules.filter((r) => r.enabled).length
  }, [brandRules])

  // Auto-generate caption when component loads or when brand rules change
  useEffect(() => {
    if (!isLoading && brandRules.length > 0 && brandRules.some((r) => r.enabled)) {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new AbortController for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setIsGeneratingCaption(true)
      generateCaption({
        request: {
          topic: "Introducing SocialHub - a new social media management platform that helps teams collaborate and create amazing content",
          keywords: ["social media", "collaboration", "content creation", "teamwork"],
          tone: "professional",
        },
        signal: abortController.signal,
      })
    }

    // Cleanup: cancel request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, enabledRulesKey, enabledRulesCount])

  const examplePost = {
    caption: generatedCaption || `🚀 Exciting news, team! We've just launched our newest feature that's going to revolutionize how you manage your social media content.

Say goodbye to scattered workflows and hello to seamless collaboration! ✨

Our new approval system lets your entire team work together effortlessly. Draft, review, approve, and publish - all in one place.

What feature would you love to see next? Drop your ideas below! 👇

#OurBrand #Innovation #Community #SocialMediaManagement`,
    platform: "LinkedIn" as const,
    image: "/modern-social-media-dashboard.jpg",
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading brand voice rules...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Rules list - Left side */}
      <div className="flex-1 overflow-auto border-r border-border">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Brand Voice</h1>
              <p className="text-sm text-muted-foreground mt-1">Define rules that guide your team's content creation</p>
            </div>
            <Button onClick={() => setShowNewRuleForm(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          </div>

          {showNewRuleForm && (
            <Card className="p-4 space-y-3 border-primary">
              <div className="space-y-2">
                <Label htmlFor="new-title">Rule Title</Label>
                <Input
                  id="new-title"
                  placeholder="e.g., Use conversational tone"
                  value={newRule.title}
                  onChange={(e) => setNewRule({ ...newRule, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  placeholder="Explain what this rule means and how to follow it..."
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddRule}
                  size="sm"
                  disabled={!newRule.title.trim() || !newRule.description.trim()}
                >
                  Add Rule
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewRuleForm(false)
                    setNewRule({ title: "", description: "" })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {brandRules.map((rule) => (
              <Card key={rule.id} className="p-4">
                {editingRule === rule.id ? (
                  <div className="space-y-3">
                    <Input
                      value={rule.title}
                      onChange={(e) => handleUpdateRule(rule.id, { title: e.target.value })}
                      className="font-medium"
                    />
                    <Textarea
                      value={rule.description}
                      onChange={(e) => handleUpdateRule(rule.id, { description: e.target.value })}
                      rows={3}
                    />
                    <Button size="sm" onClick={() => setEditingRule(null)}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">{rule.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule.id)} />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Example post - Right side */}
      <div className="w-96 overflow-auto bg-muted/20 p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Example Post</h2>
            </div>
            <Button
              onClick={handleGenerateExamplePost}
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={isGeneratingCaption || brandRules.filter((r) => r.enabled).length === 0}
            >
              {isGeneratingCaption ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Here's an AI-generated example that follows your brand voice guidelines
          </p>

          <Card className="overflow-hidden">
            <div className="aspect-video w-full overflow-hidden bg-muted">
              <img
                src={examplePost.image || "/placeholder.svg"}
                alt="Example post"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">SH</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">SocialHub</p>
                  <p className="text-xs text-muted-foreground">{examplePost.platform}</p>
                </div>
              </div>
              {isGeneratingCaption ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                  <div className="h-4 bg-muted rounded w-4/6"></div>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{examplePost.caption}</p>
              )}
            </div>
          </Card>

          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">Follows all guidelines</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This example post meets all {brandRules.filter((r) => r.enabled).length} active brand voice rules
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
