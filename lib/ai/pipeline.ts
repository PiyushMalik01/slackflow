import { openai, AI_MODEL } from './client'
import { getPromptForCategory } from './prompts'
import { parseAiOutput } from './parser'
import { getWorkspaceById, updateTaskStatus, logActivity } from '@/lib/db/queries'
import { createCorrelatedLogger } from '@/lib/utils/logger'

export async function runAiDraftPipeline(task: {
  id: string
  workspace_id: string
  original_text: string
  category: string
}): Promise<{ draft: string; tokensUsed: number; latencyMs: number }> {
  const log = createCorrelatedLogger(task.id)

  try {
    // Stage 1: Collect — get workspace context by UUID
    const workspace = await getWorkspaceById(task.workspace_id)
    log.info({ stage: 'collect', workspace: workspace.name }, 'Context loaded')

    // Stage 2: Build prompt
    const messages = getPromptForCategory(task.category, task.original_text, workspace.name)
    log.info({ stage: 'prompt', category: task.category }, 'Prompt built')

    // Stage 3: Generate
    const startMs = Date.now()
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    })
    const latencyMs = Date.now() - startMs
    const rawOutput = completion.choices[0]?.message?.content ?? ''
    const tokensUsed = completion.usage?.total_tokens ?? 0
    log.info({ stage: 'generate', latencyMs, tokensUsed }, 'AI response received')

    // Stage 4: Parse
    const parsed = parseAiOutput(rawOutput)
    log.info({ stage: 'parse', type: parsed.type }, 'Output parsed')

    // Stage 5: Persist
    await updateTaskStatus(task.id, 'draft_ready', {
      draft_text: parsed.draft,
      ai_model: AI_MODEL,
      ai_tokens_used: tokensUsed,
      draft_generated_at: new Date().toISOString(),
    })

    await logActivity({
      task_id: task.id,
      workspace_id: task.workspace_id,
      actor: 'system',
      action: 'draft_generated',
      details: { model: AI_MODEL, tokens: tokensUsed, latencyMs, type: parsed.type },
    })

    log.info({ stage: 'persist' }, 'Task updated with draft')
    return { draft: parsed.draft, tokensUsed, latencyMs }
  } catch (error) {
    log.error({ error, stage: 'pipeline' }, 'AI pipeline failed')
    await updateTaskStatus(task.id, 'failed')
    await logActivity({
      task_id: task.id,
      workspace_id: task.workspace_id,
      actor: 'system',
      action: 'draft_failed',
      details: { error: String(error) },
    })
    throw error
  }
}
