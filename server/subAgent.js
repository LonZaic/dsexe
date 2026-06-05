// ═══════════════════════════════════════════
// Sub-Agent Orchestrator — parallel worker agents
// Inspired by CC: coordinator/coordinatorMode.ts + tasks/LocalAgentTask
// ═══════════════════════════════════════════

/**
 * Spawn a sub-agent to handle a specific sub-task.
 * Uses lazy require to avoid circular dependency with codeAgent.
 */
async function spawnSubAgent({ projectPath, task, apiKey, model, onProgress, signal, parentId }) {
  const { executeCodeTask } = require('./codeAgent') // lazy to break circular dep
  const taskId = 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)

  onProgress({
    type: 'subagent_start',
    taskId,
    parentId,
    text: task,
    timestamp: Date.now(),
  })

  try {
    const wrappedTask = `你是子 Agent #${taskId}。只需要完成这一个任务，完成后报告结果。\n\n${task}`

    let result = ''
    await executeCodeTask({
      projectPath,
      task: wrappedTask,
      apiKey,
      model: model || 'deepseek-v4-flash', // sub-agents use flash for speed
      onProgress: (event) => {
        // Forward progress with sub-agent prefix
        onProgress({ ...event, subAgentId: taskId, parentId })
        if (event.type === 'done') result = event.text || ''
      },
      signal,
    })

    onProgress({
      type: 'subagent_done',
      taskId,
      parentId,
      text: result,
      timestamp: Date.now(),
    })

    return { taskId, result, success: true }
  } catch (e) {
    onProgress({
      type: 'subagent_error',
      taskId,
      parentId,
      text: e.message,
      timestamp: Date.now(),
    })
    return { taskId, result: e.message, success: false }
  }
}

/**
 * Fan-out: run multiple sub-agents in parallel with a concurrency limit.
 * Like CC's parallel() in workflows.
 *
 * @param {Array} tasks — [{ task, model? }]
 * @param {Object} opts — { projectPath, apiKey, onProgress, signal, concurrency }
 * @returns {Array} results
 */
async function fanOutAgents(tasks, opts) {
  const { projectPath, apiKey, onProgress, signal } = opts
  const concurrency = opts.concurrency || 3

  const results = new Array(tasks.length)
  let running = 0
  let nextIdx = 0

  return new Promise((resolve) => {
    function startNext() {
      while (running < concurrency && nextIdx < tasks.length) {
        const idx = nextIdx++
        running++
        spawnSubAgent({
          projectPath,
          task: tasks[idx].task,
          apiKey,
          model: tasks[idx].model,
          onProgress,
          signal,
          parentId: 'fanout_' + idx,
        }).then(r => {
          results[idx] = r
          running--
          if (nextIdx >= tasks.length && running === 0) {
            resolve(results.filter(Boolean))
          } else {
            startNext()
          }
        })
      }
    }
    startNext()
    if (tasks.length === 0) resolve([])
  })
}

/**
 * Coordinator: decompose a complex task into sub-tasks, fan-out to sub-agents,
 * then synthesize results.
 */
async function coordinateTask({ projectPath, task, apiKey, model, onProgress, signal }) {
  onProgress({ type: 'coordinator_start', text: '正在分解任务...' })

  // Step 1: Decompose into sub-tasks (using fast model)
  const decomposePrompt = `你是一个任务分解器。将以下编码任务分解为 2-5 个独立子任务，每个子任务可以并行执行。

## 用户任务
${task}

## 项目路径
${projectPath}

## 要求
1. 每个子任务必须独立（不依赖其他子任务的输出）
2. 输出 JSON 数组：[{"task":"子任务描述"}]
3. 只输出 JSON`

  let subTasks = []
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: decomposePrompt }], max_tokens: 1024, temperature: 0.2 }),
      signal,
    })
    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || '[]'
    subTasks = JSON.parse(reply.replace(/```json|```/g, '').trim())
  } catch {
    subTasks = [{ task }] // fallback: execute as single agent
  }

  if (!subTasks.length) subTasks = [{ task }]

  onProgress({ type: 'coordinator_plan', subTasks, count: subTasks.length })

  // Step 2: Fan-out to sub-agents
  const results = await fanOutAgents(subTasks, {
    projectPath, apiKey,
    onProgress,
    signal,
    concurrency: Math.min(subTasks.length, 3),
  })

  // Step 3: Synthesize results
  const summary = results.map(r =>
    `- [${r.success ? 'OK' : 'FAIL'}] ${r.taskId}: ${(r.result || '').slice(0, 200)}`
  ).join('\n')

  onProgress({ type: 'coordinator_done', summary, results, successCount: results.filter(r => r.success).length })

  return { subTasks: subTasks.length, results, summary }
}

module.exports = {
  spawnSubAgent,
  fanOutAgents,
  coordinateTask,
}
