// server/ai-service/streaming-callback.ts
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";
import { streamManager } from "./stream-manager";

/**
 * User-friendly names for tools
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'get_posts': 'Fetching posts',
  'get_current_post': 'Loading post details',
  'generate_caption': 'Generating caption',
  'grade_caption': 'Evaluating caption',
  'search_documents': 'Searching knowledge base',
  'navigate_to_calendar': 'Navigating to calendar',
  'apply_caption_to_open_post': 'Applying caption',
  'create_post': 'Creating post',
  'open_post': 'Opening post',
};

/**
 * Helper to extract tool name from Serialized object
 */
function extractToolName(tool: Serialized): string {
  // Try multiple ways to extract the tool name
  // 1. Check if tool has a name property directly
  if (tool.name) {
    return tool.name;
  }
  
  // 2. Check if tool is SerializedConstructor and has kwargs.name
  if (tool.type === 'constructor' && 'kwargs' in tool) {
    const constructorTool = tool as { kwargs?: { name?: string } };
    if (constructorTool.kwargs?.name) {
      return constructorTool.kwargs.name;
    }
  }
  
  // 3. Check if tool has a name in the id array (last element)
  if (Array.isArray(tool.id) && tool.id.length > 0) {
    const lastId = tool.id[tool.id.length - 1];
    // If it's a string and looks like a tool name, use it
    if (typeof lastId === 'string' && lastId.includes('_')) {
      return lastId;
    }
  }
  
  // 4. Try to get from the serialized path
  if (tool.id && Array.isArray(tool.id)) {
    // Look for tool name in the path
    for (let i = tool.id.length - 1; i >= 0; i--) {
      const segment = tool.id[i];
      if (typeof segment === 'string' && segment.includes('_') && segment.length > 3) {
        return segment;
      }
    }
  }
  
  // 5. Fallback: try to get from the full serialized path
  const fullPath = JSON.stringify(tool.id);
  const match = fullPath.match(/"([a-z_]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  
  return 'tool';
}

/**
 * Get user-friendly display name for a tool
 */
function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export class StreamingCallbackHandler extends BaseCallbackHandler {
  name = "StreamingCallbackHandler";
  private threadId: string;

  constructor(threadId: string) {
    super();
    this.threadId = threadId;
  }

  async handleLLMStart(_llm: Serialized, _prompts: string[]) {
    // When LLM starts thinking/generating
    streamManager.emitEvent(this.threadId, {
      type: 'status_start',
      content: 'Thinking...',
      timestamp: Date.now()
    });
  }

  async handleLLMNewToken(token: string) {
    streamManager.emitEvent(this.threadId, {
      type: 'token',
      content: token,
      timestamp: Date.now()
    });
  }

  async handleLLMEnd(_output: any) {
    // Clear status when LLM finishes
    streamManager.emitEvent(this.threadId, {
      type: 'status_end',
      timestamp: Date.now()
    });
  }

  async handleToolStart(tool: Serialized, _input: string, _runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string) {
    // Use runName if available (contains the actual tool name for dynamic tools)
    // Otherwise fall back to extracting from Serialized object
    const toolName = runName || extractToolName(tool);
    const displayName = getToolDisplayName(toolName);
    
    console.log("handleToolStart", { tool, toolName, displayName, runName });
    
    streamManager.emitEvent(this.threadId, {
      type: 'status_start',
      toolName: toolName,
      content: displayName,
      timestamp: Date.now()
    });
  }

  async handleToolEnd(_output: string) {
    streamManager.emitEvent(this.threadId, {
      type: 'status_end',
      timestamp: Date.now()
    });
  }

  async handleChainStart(chain: Serialized, _inputs: any) {
    // Detect specific chain types for better status messages
    const chainName = Array.isArray(chain.id) ? chain.id[chain.id.length - 1] : 'chain';
    
    // Only show status for specific chains we care about
    if (chainName === 'search_documents' || chainName?.includes('search')) {
      streamManager.emitEvent(this.threadId, {
        type: 'status_start',
        content: 'Searching knowledge base...',
        timestamp: Date.now()
      });
    }
  }

  async handleChainEnd(_outputs: any) {
    // Chain end might clear status, but we let tool/LLM handlers manage their own
  }
}


