import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { CallbackHandler } from "@langfuse/langchain";
import Langfuse from "langfuse";

// Initialize OpenTelemetry SDK with Langfuse span processor
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

// Create and export a singleton Langfuse callback handler
// This handler can be used with any LangChain invoke() call
export const langfuseHandler = new CallbackHandler();

// Create and export a Langfuse client instance for explicit tracing
// This is used to create traces manually and pass trace IDs to the client
export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY || "",
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || "",
  baseUrl: process.env.LANGFUSE_BASEURL || "https://cloud.langfuse.com",
  flushAt: 1
});

