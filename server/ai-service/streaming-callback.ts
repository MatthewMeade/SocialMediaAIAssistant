import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";
import { streamManager } from "./stream-manager";

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

function extractToolName(tool: Serialized): string {
  if (tool.name) {
    return tool.name;
  }
  
  if (tool.type === 'constructor' && 'kwargs' in tool) {
    const constructorTool = tool as { kwargs?: { name?: string } };
    if (constructorTool.kwargs?.name) {
      return constructorTool.kwargs.name;
    }
  }
  
  if (Array.isArray(tool.id) && tool.id.length > 0) {
    const lastId = tool.id[tool.id.length - 1];
    if (typeof lastId === 'string' && lastId.includes('_')) {
      return lastId;
    }
  }
  
  if (tool.id && Array.isArray(tool.id)) {
    for (let i = tool.id.length - 1; i >= 0; i--) {
      const segment = tool.id[i];
      if (typeof segment === 'string' && segment.includes('_') && segment.length > 3) {
        return segment;
      }
    }
  }
  
  const fullPath = JSON.stringify(tool.id);
  const match = fullPath.match(/"([a-z_]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  
  return 'tool';
}

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
    streamManager.emitEvent(this.threadId, {
      type: 'status_end',
      timestamp: Date.now()
    });
  }

  async handleToolStart(tool: Serialized, _input: string, _runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string) {
    const toolName = runName || extractToolName(tool);
    const displayName = getToolDisplayName(toolName);
    
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
    const chainName = Array.isArray(chain.id) ? chain.id[chain.id.length - 1] : 'chain';
    
    if (chainName === 'search_documents' || chainName?.includes('search')) {
      streamManager.emitEvent(this.threadId, {
        type: 'status_start',
        content: 'Searching knowledge base...',
        timestamp: Date.now()
      });
    }
  }

  async handleChainEnd(_outputs: any) {
  }
}


