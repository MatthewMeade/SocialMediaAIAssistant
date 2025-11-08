import { createClient } from "@supabase/supabase-js"

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export const supabase = createClient(
  getEnvVar("SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export const supabaseAnon = createClient(
  getEnvVar("SUPABASE_URL"),
  getEnvVar("SUPABASE_ANON_KEY"),
)
