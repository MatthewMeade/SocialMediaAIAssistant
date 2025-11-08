import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getScoreColor, getScoreBgColor } from "./utils"
import type { BrandScore } from "@/lib/types"

interface PostBrandScoreCardProps {
  brandScore: BrandScore | null
  isFetchingScore: boolean
  onToggle: () => void
}

export function PostBrandScoreCard({
  brandScore,
  isFetchingScore,
  onToggle,
}: PostBrandScoreCardProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full rounded-lg border border-border bg-card p-4 hover:bg-accent transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h4 className="text-sm font-medium text-foreground">Brand Voice Score</h4>
            <p className="text-xs text-muted-foreground">Click to see detailed analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={cn("text-2xl font-bold", brandScore ? getScoreColor(brandScore.overall) : "text-muted-foreground")}>
              {isFetchingScore ? "..." : brandScore ? `${brandScore.overall}%` : "N/A"}
            </div>
            <div className="text-xs text-muted-foreground">
              {isFetchingScore
                ? "Analyzing..."
                : brandScore
                  ? brandScore.overall >= 80
                    ? "Excellent"
                    : brandScore.overall >= 50
                      ? "Good"
                      : "Needs work"
                  : "No score"}
            </div>
          </div>
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-muted" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className={brandScore ? getScoreBgColor(brandScore.overall) : "stroke-muted"}
                strokeWidth="3"
                strokeDasharray={brandScore ? `${brandScore.overall} 100` : "0 100"}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.5s ease-in-out" }}
              />
            </svg>
          </div>
        </div>
      </div>
    </button>
  )
}

