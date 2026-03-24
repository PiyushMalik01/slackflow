import { classifyAndDraft } from '@/lib/ai/classifier'
import { getCategories, getCategoryByName } from '@/lib/db/queries'
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

interface PipelineInput {
  taskId: string
  workspaceId: string
  ownerId: string
  message: string
  senderName: string
  channel: string
  threadContext?: string | null
}

interface PipelineResult {
  category: string
  categoryId: string | null
  draft: string | null
  confidence: number
  promptVersion: string
}

export async function runAiPipeline(input: PipelineInput): Promise<PipelineResult> {
  const log = logger.child({ taskId: input.taskId })
  const supabase = getServiceClient()

  try {
    // Load categories for the workspace owner
    const categories = await getCategories(input.ownerId)
    if (categories.length === 0) {
      log.warn('No categories found, using fallback')
      return {
        category: 'General',
        categoryId: null,
        draft: null,
        confidence: 0,
        promptVersion: 'fallback-no-categories',
      }
    }

    // Combined classify + draft
    const result = await classifyAndDraft(
      input.message,
      input.senderName,
      input.channel,
      categories,
      input.threadContext,
    )

    // Resolve category ID
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === result.category.toLowerCase()
    )
    const categoryId = matchedCategory?.id || null

    // Update task with results
    await supabase.from('tasks').update({
      category: result.category,
      category_id: categoryId,
      draft_text: result.draft,
      ai_model: process.env.AI_MODEL || 'gpt-4o-mini',
      ai_prompt_version: result.promptVersion,
      draft_generated_at: new Date().toISOString(),
      status: 'draft_ready',
    }).eq('id', input.taskId)

    // Log activity
    await supabase.from('activity_log').insert({
      workspace_id: input.workspaceId,
      task_id: input.taskId,
      actor: 'ai',
      action: 'draft_generated',
      details: {
        category: result.category,
        confidence: result.confidence,
        model: process.env.AI_MODEL || 'gpt-4o-mini',
      },
    })

    log.info({ category: result.category, confidence: result.confidence }, 'AI pipeline complete')

    return {
      category: result.category,
      categoryId,
      draft: result.draft,
      confidence: result.confidence,
      promptVersion: result.promptVersion,
    }
  } catch (err) {
    log.error({ err }, 'AI pipeline failed, using fallback')

    // Fallback: General category, no draft
    const generalCategory = await getCategoryByName(input.ownerId, 'General')

    await supabase.from('tasks').update({
      category: 'General',
      category_id: generalCategory?.id || null,
      ai_prompt_version: 'failed',
      status: 'pending',
    }).eq('id', input.taskId)

    await supabase.from('activity_log').insert({
      workspace_id: input.workspaceId,
      task_id: input.taskId,
      actor: 'ai',
      action: 'draft_failed',
      details: { error: err instanceof Error ? err.message : 'Unknown error' },
    })

    return {
      category: 'General',
      categoryId: generalCategory?.id || null,
      draft: null,
      confidence: 0,
      promptVersion: 'failed',
    }
  }
}
