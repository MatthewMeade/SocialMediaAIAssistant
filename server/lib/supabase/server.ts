import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export function createClient() {
  return createSupabaseClient(
    getEnvVar("SUPABASE_URL"),
    getEnvVar("SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

