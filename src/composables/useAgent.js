// ══════════════════════════════════════
// useAgent — composable for agent orchestration
// Extracts agent logic from ChatView for reuse
// ══════════════════════════════════════

import { ref, computed } from 'vue'
import { useAgentStore } from '../stores/agentStore.js'
import { useChatStore } from '../store/chatStore.js'
import { runAgent, runGroupAgent, judgeTask } from '../api/agent.api.js'

export function useAgent(convId) {
  const agentStore = useAgentStore()
  const chatStore = useChatStore()

  const isRunning = computed(() => agentStore.isAgentRunning(convId))
  const events = computed(() => agentStore.agentEvents(convId))

  /**
   * Start an agent run for personal conversation.
   * Returns a promise that resolves when the agent finishes.
   */
  async function startAgent(task, model, permissionMode = 'default') {
    const cid = convId || chatStore.currentId
    if (!cid) throw new Error('No active conversation')

    const controller = new AbortController()
    agentStore.startAgent(cid, controller)
    agentStore.clearAgentEvents(cid)

    // Add user message to store
    chatStore.addUserMessage(task)

    // Start streaming reply placeholder
    const tempId = chatStore.startStreamReply(cid)
    let fullText = ''

    try {
      await runAgent(task, model, permissionMode, (event) => {
        agentStore.addAgentEvent(cid, event)

        switch (event.type) {
          case 'thinking':
            break
          case 'final_chunk':
            fullText += event.text
            chatStore.appendStreamText(tempId, fullText)
            break
          case 'done':
            fullText = event.text
            chatStore.updateStreamCleanText(tempId, fullText)
            break
          case 'error':
            chatStore.appendStreamText(tempId, `\n\nError: ${event.text}`)
            break
          case 'final':
            fullText = event.text
            chatStore.updateStreamCleanText(tempId, fullText)
            break
        }
      })

      chatStore.finishStreamReply(tempId)
      agentStore.finishAgent(cid)
      return fullText
    } catch (err) {
      chatStore.appendStreamText(tempId, `\n\nError: ${err.message}`)
      chatStore.finishStreamReply(tempId)
      agentStore.finishAgent(cid)
      throw err
    }
  }

  /**
   * Start a group agent run.
   */
  async function startGroupAgent(task, roomId, model, permissionMode = 'default') {
    const controller = new AbortController()
    const cid = `group_${roomId}`
    agentStore.startAgent(cid, controller)
    agentStore.clearAgentEvents(cid)

    let fullText = ''

    try {
      await runGroupAgent(task, roomId, model, permissionMode, (event) => {
        agentStore.addAgentEvent(cid, event)

        if (event.type === 'final_chunk') {
          fullText += event.text
        } else if (event.type === 'final') {
          fullText = event.text
        }
      })

      agentStore.finishAgent(cid)
      return fullText
    } catch (err) {
      agentStore.finishAgent(cid)
      throw err
    }
  }

  function stopAgent() {
    const cid = convId || chatStore.currentId
    if (cid) agentStore.stopAgent(cid)
  }

  return {
    isRunning,
    events,
    startAgent,
    startGroupAgent,
    stopAgent,
    judgeTask,
  }
}
