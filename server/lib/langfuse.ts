import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { CallbackHandler } from "@langfuse/langchain";

// Initialize OpenTelemetry SDK with Langfuse span processor
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

// Create and export a singleton Langfuse callback handler
// This handler can be used with any LangChain invoke() call
export const langfuseHandler = new CallbackHandler();

