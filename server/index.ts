import "./load-env"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import postsRouter from "./routes/posts"
import calendarsRouter from "./routes/calendars"
import brandVoiceRouter from "./routes/brand-voice"
import authRouter from "./routes/auth"
import profileRouter from "./routes/profile"
import aiRouter from './routes/ai'
import uploadRouter from './routes/upload'
import mediaRouter from './routes/media'
import organizationRouter from './routes/organization'
import notesRouter from './routes/notes'


const app = new Hono()

app.use("*", logger())
app.use(
  "*",
  cors({
    origin: process.env.NODE_ENV === "production" ? process.env.CLIENT_URL || "*" : "http://localhost:3000",
    credentials: true,
  }),
)

app.get("/api/health", (c) => c.json({ status: "ok" }))

app.route("/api/auth", authRouter)
app.route("/api/posts", postsRouter)
app.route("/api/calendars", calendarsRouter)
app.route("/api/brand-voice", brandVoiceRouter)
app.route("/api/profile", profileRouter)
app.route('/api/ai', aiRouter)
app.route('/api/upload', uploadRouter)
app.route('/api/media', mediaRouter)
app.route('/api/organization', organizationRouter)
app.route('/api/notes', notesRouter)


const port = Number(process.env.PORT) || 3001

console.log(`🚀 Server running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
