// This file must be imported FIRST before any other imports
import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"

// Load .env.local first (higher priority), then .env as fallback
const envLocalPath = resolve(process.cwd(), ".env.local")
const envPath = resolve(process.cwd(), ".env")

if (existsSync(envLocalPath)) {
  const result = config({ path: envLocalPath })
  if (result.error) {
    console.warn("Warning: Error loading .env.local:", result.error.message)
  } else {
    console.log("✓ Loaded .env.local")
  }
} else if (existsSync(envPath)) {
  const result = config({ path: envPath })
  if (result.error) {
    console.warn("Warning: Error loading .env:", result.error.message)
  } else {
    console.log("✓ Loaded .env")
  }
} else {
  // Try parent directory (in case running from a subdirectory)
  const parentEnvLocal = resolve(process.cwd(), "..", ".env.local")
  const parentEnv = resolve(process.cwd(), "..", ".env")
  if (existsSync(parentEnvLocal)) {
    const result = config({ path: parentEnvLocal })
    if (result.error) {
      console.warn("Warning: Error loading ../.env.local:", result.error.message)
    } else {
      console.log("✓ Loaded ../.env.local")
    }
  } else if (existsSync(parentEnv)) {
    const result = config({ path: parentEnv })
    if (result.error) {
      console.warn("Warning: Error loading ../.env:", result.error.message)
    } else {
      console.log("✓ Loaded ../.env")
    }
  } else {
    // Fallback to default dotenv behavior
    config()
    console.log("✓ Loaded default .env (if exists)")
  }
}

// Verify required env vars are present
if (!process.env.SUPABASE_URL) {
  console.error("❌ Missing SUPABASE_URL environment variable")
  console.error("   Make sure you have a .env.local file with SUPABASE_URL set")
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
}
if (!process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Missing SUPABASE_ANON_KEY environment variable")
}

