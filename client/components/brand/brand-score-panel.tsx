import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertCircle, Sparkles, X } from "lucide-react"
import type { BrandScore, BrandRule } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BrandScorePanelProps {
  score: BrandScore
  rules: BrandRule[]
  onApplySuggestions: () => void
  onClose: () => void
}

export function BrandScorePanel({ score, rules, onApplySuggestions, onClose }: BrandScorePanelProps) {
  const getScoreIcon = (ruleScore: number) => {
    if (ruleScore >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (ruleScore >= 50) return <AlertCircle className="h-4 w-4 text-yellow-600" />
    return <XCircle className="h-4 w-4 text-red-600" />
  }

  const getScoreColor = (ruleScore: number) => {
    if (ruleScore >= 80) return "text-green-600"
    if (ruleScore >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBgColor = (ruleScore: number) => {
    if (ruleScore >= 80) return "bg-green-500/10 border-green-500/20"
    if (ruleScore >= 50) return "bg-yellow-500/10 border-yellow-500/20"
    return "bg-red-500/10 border-red-500/20"
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Brand Voice Analysis</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 mb-3">
          <span className="text-sm font-medium text-foreground">Overall Score</span>
          <div className="flex items-center gap-2">
            <span className={cn("text-xl font-bold", getScoreColor(score.overall))}>{score.overall}%</span>
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-muted" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className={
                    score.overall >= 80
                      ? "stroke-green-500"
                      : score.overall >= 50
                        ? "stroke-yellow-500"
                        : "stroke-red-500"
                  }
                  strokeWidth="3"
                  strokeDasharray={`${score.overall} 100`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Suggested edits */}
        {score.suggestions.length > 0 && (
          <Card className="p-3 space-y-3 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Suggested Edits</span>
            </div>
            <ul className="space-y-2">
              {score.suggestions.map((suggestion, index) => (
                <li key={index} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
            <Button onClick={onApplySuggestions} size="sm" className="w-full gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Apply Suggestions
            </Button>
          </Card>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rule Breakdown</h4>
        {score.rules.map((ruleScore) => {
          const rule = rules.find((r) => r.id === ruleScore.ruleId)
          if (!rule) return null

          return (
            <Card key={ruleScore.ruleId} className={cn("p-3 space-y-2", getScoreBgColor(ruleScore.score))}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {getScoreIcon(ruleScore.score)}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-foreground">{rule.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1">{ruleScore.feedback}</p>
                  </div>
                </div>
                <span className={cn("text-sm font-bold shrink-0", getScoreColor(ruleScore.score))}>
                  {ruleScore.score}%
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
