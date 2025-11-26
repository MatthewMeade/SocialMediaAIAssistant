import type { ToolService } from './services/tool-service'

/**
 * Context keys that determine which tools are available to the AI agent.
 * These keys are derived from the clientContext sent by the frontend.
 */
export type ContextKey = 'global' | 'calendar' | 'postEditor' | 'brandVoice'

/**
 * Static map of context keys to ToolService method names.
 * Each method name corresponds to a factory method on ToolService that creates a tool.
 */
const toolManifest: Record<ContextKey, string[]> = {
  global: ['createNavigateToPageTool', 'createGenerateCaptionTool', 'createGetBrandRulesTool', 'createGradeCaptionTool'],
  calendar: [
    'createGetPostsTool',
    'createGenerateCaptionTool',
    'createGetBrandRulesTool',
    'createGradeCaptionTool',
    'createCreatePostTool',
    'createOpenPostTool',
  ],
  postEditor: ['createGenerateCaptionTool', 'createApplyCaptionTool', 'createGetBrandRulesTool', 'createGradeCaptionTool'],
  brandVoice: ['createGetBrandRulesTool', 'createGradeCaptionTool'], // Brand rules and grading tools available on brand voice page
}

/**
 * Converts client context object to context keys.
 * The clientContext is sent from the frontend and indicates what page/component is active.
 */
export function getContextKeys(clientContext?: {
  page?: string
  component?: string
  postId?: string
}): ContextKey[] {
  const keys: ContextKey[] = ['global'] // Global tools are always available

  if (!clientContext) {
    return keys
  }

  // Add context keys based on the current page/component
  if (clientContext.page === 'calendar' || clientContext.component === 'calendar') {
    keys.push('calendar')
  }

  if (clientContext.component === 'postEditor' || clientContext.postId) {
    keys.push('postEditor')
  }

  if (clientContext.page === 'brandVoice' || clientContext.component === 'brandVoice') {
    keys.push('brandVoice')
  }

  return keys
}

/**
 * Gets the appropriate tools for the given context keys.
 * Calls the factory methods on the ToolService instance to create tool instances.
 */
export function getToolsForContext(
  contextKeys: ContextKey[],
  toolService: ToolService,
): any[] {
  const tools: any[] = []
  const methodNames = new Set<string>()

  // Collect all unique method names from the relevant context keys
  for (const key of contextKeys) {
    const methods = toolManifest[key] || []
    for (const methodName of methods) {
      methodNames.add(methodName)
    }
  }

  // Call each factory method on the ToolService instance
  for (const methodName of methodNames) {
    const method = (toolService as any)[methodName]
    if (typeof method === 'function') {
      try {
        const tool = method.call(toolService)
        if (tool) {
          tools.push(tool)
        }
      } catch (error) {
        console.error(
          `[TOOL_MANIFEST] Error creating tool ${methodName}:`,
          error,
        )
      }
    } else {
      console.warn(
        `[TOOL_MANIFEST] Method ${methodName} not found on ToolService`,
      )
    }
  }

  return tools
}

