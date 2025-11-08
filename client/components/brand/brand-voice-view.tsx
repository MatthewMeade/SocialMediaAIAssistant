import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Sparkles } from "lucide-react"
import type { BrandRule } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { useBrandRules } from "@/lib/hooks/use-brand-rules"

interface BrandVoiceViewProps {
  calendarId: string
}

export function BrandVoiceView({ calendarId }: BrandVoiceViewProps) {
  const { brandRules, isLoading, createBrandRule, updateBrandRule, deleteBrandRule } = useBrandRules(calendarId)
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [newRule, setNewRule] = useState({ title: "", description: "" })
  const [showNewRuleForm, setShowNewRuleForm] = useState(false)

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

  const examplePost = {
    caption: `🚀 Exciting news, team! We've just launched our newest feature that's going to revolutionize how you manage your social media content.

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
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Example Post</h2>
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
                  <span className="text-sm font-medium text-primary">YB</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Your Brand</p>
                  <p className="text-xs text-muted-foreground">{examplePost.platform}</p>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{examplePost.caption}</p>
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
