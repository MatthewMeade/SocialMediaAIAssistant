import { LangfuseWeb } from "langfuse";

export const langfuseWeb = new LangfuseWeb({
  publicKey: import.meta.env.VITE_LANGFUSE_PUBLIC_KEY,
  baseUrl: import.meta.env.VITE_LANGFUSE_BASEURL,
  // Optional: persist user ID if you want to track sessions across reloads
  // persistence: "localStorage" 
});



