# Environment Variables Configuration

This project uses separate environment variables for the **client** (frontend) and **server** (backend).

## Setup

### 1. Create Environment Files

Create a `.env.local` file in the root directory with the following variables:

```bash
# Client Environment Variables (Vite)
# These variables are exposed to the browser and must be prefixed with VITE_
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_REDIRECT_URL=http://localhost:3000

# Server Environment Variables
# These variables are only available on the server
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Supabase Configuration (Server-side)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. How It Works

#### Client (Frontend) - Vite
- **File**: `.env.local` in the root directory
- **Prefix**: All client variables must be prefixed with `VITE_`
- **Access**: Use `import.meta.env.VITE_*` in your client code
- **Exposure**: These variables are **bundled into the client code** and are visible in the browser
- **Example**: 
  ```typescript
  const url = import.meta.env.VITE_SUPABASE_URL
  ```

#### Server (Backend) - Node.js/Hono
- **File**: `.env.local` in the root directory (same file, different variables)
- **Prefix**: No prefix required for server variables
- **Access**: Use `process.env.*` in your server code
- **Exposure**: These variables are **only available on the server** and never sent to the client
- **Example**:
  ```typescript
  const url = process.env.SUPABASE_URL
  ```

### 3. Environment Variable Loading

#### Client (Vite)
- **Automatic**: Vite automatically loads `.env.local` files - no additional setup needed
- Variables are loaded at build time and bundled into the client code

#### Server (Node.js)
- **Requires dotenv**: The server uses the `dotenv` package to load environment variables
- Already configured: `import "dotenv/config"` is added at the top of `server/index.ts`
- Automatically loads `.env.local` when the server starts

For production, you'll need to set these variables in your deployment environment (e.g., Vercel, Railway, etc.).

### 4. Important Notes

⚠️ **Security**:
- Variables prefixed with `VITE_` are **public** and will be visible in the browser
- Never put sensitive keys (like service role keys) in `VITE_*` variables
- Server-only variables (without `VITE_` prefix) are safe for sensitive data

📝 **Variable Naming**:
- Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`

🔄 **Shared Values**:
- Both client and server may need the same Supabase URL, but they use different variable names:
  - Client: `VITE_SUPABASE_URL`
  - Server: `SUPABASE_URL`

### 5. Production Deployment

When deploying:

1. **Client**: Set `VITE_*` variables in your build environment
2. **Server**: Set server variables in your server runtime environment

Example for different platforms:
- **Vercel**: Add variables in Project Settings → Environment Variables
- **Railway**: Add variables in the Variables tab
- **Docker**: Pass via `-e` flags or `.env` file

### 6. Current Variables Used

#### Client (`client/lib/supabase/client.ts`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_REDIRECT_URL` (used in login form)

#### Server (`server/lib/supabase.ts`, `server/lib/supabase/server.ts`):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (defaults to 3001)
- `NODE_ENV`
- `CLIENT_URL` (for CORS configuration)

