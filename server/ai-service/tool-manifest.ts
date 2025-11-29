import type { ToolService } from './services/tool-service'

export type ContextKey = 'global' | 'calendar' | 'postEditor' | 'brandVoice'

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
  brandVoice: ['createGetBrandRulesTool', 'createGradeCaptionTool'],
}

export function getContextKeys(clientContext?: {
  page?: string
  component?: string
  postId?: string
}): ContextKey[] {
  const keys: ContextKey[] = ['global']

  if (!clientContext) {
    return keys
  }

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

export function getToolsForContext(
  contextKeys: ContextKey[],
  toolService: ToolService,
): any[] {
  const tools: any[] = []
  const methodNames = new Set<string>()

  for (const key of contextKeys) {
    const methods = toolManifest[key] || []
    for (const methodName of methods) {
      methodNames.add(methodName)
    }
  }

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

