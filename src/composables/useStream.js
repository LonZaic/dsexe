// ══════════════════════════════════════
// useStream — composable for AI streaming
// Handles SSE stream parsing and state management
// ══════════════════════════════════════

import { ref } from 'vue'
import { aiChatStream } from '../api/agent.api.js'

export function useStream() {
  const isStreaming = ref(false)
  const streamText = ref('')
  const streamReasoning = ref('')
  const abortController = ref(null)

  /**
   * Start an AI chat stream (non-agent, plain chat).
   * @param {Array} messages - message history
   * @param {string} model - model name
   * @param {function} onChunk - optional per-chunk callback
   */
  async function startStream(messages, model = 'deepseek-v4-flash', onChunk) {
    isStreaming.value = true
    streamText.value = ''
    streamReasoning.value = ''

    const { abort, promise } = aiChatStream(
      messages,
      model,
      (data) => {
        const delta = data.choices?.[0]?.delta
        if (delta?.content) {
          streamText.value += delta.content
          onChunk?.({ type: 'content', text: delta.content, full: streamText.value })
        }
        if (delta?.reasoning_content) {
          streamReasoning.value += delta.reasoning_content
          onChunk?.({ type: 'reasoning', text: delta.reasoning_content, full: streamReasoning.value })
        }
      },
      () => {
        isStreaming.value = false
      }
    )

    abortController.value = { abort }

    try {
      await promise
    } catch (err) {
      if (err.name !== 'AbortError') {
        streamText.value += `\n\nError: ${err.message}`
      }
    } finally {
      isStreaming.value = false
    }

    return streamText.value
  }

  function stopStream() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    isStreaming.value = false
  }

  function reset() {
    streamText.value = ''
    streamReasoning.value = ''
    isStreaming.value = false
  }

  return {
    isStreaming,
    streamText,
    streamReasoning,
    startStream,
    stopStream,
    reset,
  }
}
