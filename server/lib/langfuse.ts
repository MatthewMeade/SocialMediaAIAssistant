import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { CallbackHandler } from "@langfuse/langchain";
import Langfuse from "langfuse";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

export const langfuseHandler = new CallbackHandler();

export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY || "",
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || "",
  baseUrl: process.env.LANGFUSE_BASEURL || "https://cloud.langfuse.com",
  flushAt: 1
});

