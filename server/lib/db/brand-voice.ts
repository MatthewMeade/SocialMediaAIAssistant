import { supabase } from "../supabase"
import type { BrandRule } from "../../../shared/types"

export async function getBrandRules(calendarId: string): Promise<BrandRule[]> {

  const { data, error } = await supabase
    .from("brand_rules")
    .select("*")
    .eq("calendar_id", calendarId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error loading brand rules:", error)
    return []
  }

  return (data || []).map((rule: any) => ({
    id: rule.id,
    calendarId: rule.calendar_id,
    title: rule.title,
    description: rule.description,
    enabled: rule.enabled,
  }))
}

export async function saveBrandRule(rule: BrandRule): Promise<BrandRule | null> {

  const { data, error } = await supabase
    .from("brand_rules")
    .upsert({
      id: rule.id,
      calendar_id: rule.calendarId,
      title: rule.title,
      description: rule.description,
      enabled: rule.enabled,
    })
    .select()
    .single()

  if (error) {
    console.error("Error saving brand rule:", error)
    return null
  }

  return {
    id: data.id,
    calendarId: data.calendar_id,
    title: data.title,
    description: data.description,
    enabled: data.enabled,
  }
}

export async function deleteBrandRule(ruleId: string): Promise<boolean> {

  const { error } = await supabase.from("brand_rules").delete().eq("id", ruleId)

  if (error) {
    console.error("Error deleting brand rule:", error)
    return false
  }

  return true
}
