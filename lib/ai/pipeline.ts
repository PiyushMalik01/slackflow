import { classifyAndDraft } from '@/lib/ai/classifier'
import { getCategories, getCategoryByName } from '@/lib/db/queries'
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

interface PipelineInput {
  taskId: string
  workspaceId: string
  ownerId: string
  workspaceName: string
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
  actionable?: boolean
  additionalTaskIds?: string[]
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

    // Load team context
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name, type, status, telegram_chat_id')
      .eq('owner_id', input.ownerId)

    const { data: workspaceRoles } = await supabase
      .from('workspace_roles')
      .select('category_id, role_id')
      .eq('workspace_id', input.workspaceId)

    // Combined classify + draft with full team context
    const result = await classifyAndDraft(
      input.message,
      input.senderName,
      input.channel,
      categories,
      (roles || []).map(r => ({ id: r.id, name: r.name, type: r.type, status: r.status || undefined })),
      (workspaceRoles || []).map(wr => ({ category_id: wr.category_id, role_id: wr.role_id })),
      input.workspaceName,
      input.threadContext,
      input.ownerId,
    )

    // If AI determined the message is NOT actionable, delete the pending task
    if (!result.actionable) {
      log.info({ reasoning: result.intents[0]?.reasoning }, 'Message not actionable, removing task')
      await supabase.from('tasks').delete().eq('id', input.taskId)
      return {
        category: 'General',
        categoryId: null,
        draft: null,
        confidence: 0,
        promptVersion: result.promptVersion,
        actionable: false,
      }
    }

    const intents = result.intents

    // First intent updates the existing task
    const primary = intents[0]
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === primary.category.toLowerCase()
    )
    const categoryId = matchedCategory?.id || null

    // Update task with results
    await supabase.from('tasks').update({
      category: primary.category,
      category_id: categoryId,
      draft_text: primary.draft,
      ai_model: process.env.AI_MODEL || 'gpt-4o-mini',
      ai_prompt_version: result.promptVersion,
      draft_generated_at: new Date().toISOString(),
      status: 'draft_ready',
    }).eq('id', input.taskId)

    // Additional intents create new tasks
    const additionalTaskIds: string[] = []
    for (let i = 1; i < intents.length; i++) {
      const intent = intents[i]
      const cat = categories.find(c => c.name.toLowerCase() === intent.category.toLowerCase())

      const { data: newTask } = await supabase.from('tasks').insert({
        workspace_id: input.workspaceId,
        channel: input.channel,
        thread_ts: '',
        original_text: intent.excerpt || input.message,
        sender_name: input.senderName,
        category: intent.category,
        category_id: cat?.id || null,
        draft_text: intent.draft,
        status: 'draft_ready',
        ai_model: process.env.AI_MODEL || 'gpt-4o-mini',
        ai_prompt_version: result.promptVersion,
        draft_generated_at: new Date().toISOString(),
        thread_context: input.threadContext,
      }).select('id').single()

      if (newTask) additionalTaskIds.push(newTask.id)
    }

    // Log activity
    await supabase.from('activity_log').insert({
      workspace_id: input.workspaceId,
      task_id: input.taskId,
      actor: 'ai',
      action: 'draft_generated',
      details: {
        category: primary.category,
        confidence: primary.confidence,
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        total_intents: intents.length,
        additional_tasks: additionalTaskIds,
      },
    })

    log.info(
      { category: primary.category, confidence: primary.confidence, totalIntents: intents.length },
      'AI pipeline complete',
    )

    return {
      category: primary.category,
      categoryId,
      draft: primary.draft,
      confidence: primary.confidence,
      promptVersion: result.promptVersion,
      actionable: true,
      additionalTaskIds,
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
