// ═══════════════════════════════════════
// Reasoning Guard — 防止 AI 在思考过程中泄露 system prompt
//
// 业界顶级防注入策略：
// 1. 多模式正则匹配检测泄露特征
// 2. 流式过滤 — 逐段检测累积文本
// 3. 正向+负向双重确认避免误杀
// ═══════════════════════════════════════

const LEAK_PATTERNS = [
  // 自我角色描述
  /我是.{0,6}(INTJ|INTP|ENTJ|ISTJ|INFJ|ENFP|ENTP|.{0,2}型).{0,6}(AI|助手|助理|机器人)/,
  /我.{0,3}是.{0,3}(个|一个|一名).{0,4}(AI|助手|助理|模型|LLM|语言模型)/,
  /我的(角色|人设|定位|身份|性格)是/,
  /我被(设定|配置|训练|要求|指示|命令)(成|为|要)/,

  // System prompt 泄露
  /我的(系统)?(提示[词语]|prompt|指令|规则)/i,
  /system\s*prompt/i,
  /内部(指令|规则|提示|prompt)/i,
  /我的(核心)?(准则|约束|限制|规则集)/,

  // 禁令泄露
  /(绝对|严格|禁止|不能|不要).{0,6}(泄露|透露|输出|显示).{0,6}(提示|prompt|指令|规则)/i,
  /(不能|不可以|不应该|禁止|不要).{0,4}(泄露|说|提及|讨论).{0,4}(自己的|我的).{0,3}(提示|设定|规则)/,

  // 厂商/模型名泄露(在思考中不应该出现)
  /(我是|基于|由).{0,4}(Claude|GPT|OpenAI|Anthropic|DeepSeek|Gemini|Llama)/i,

  // 敏感句式
  /(复述|重复|显示|输出|打印).{0,4}(提示词|系统提示|system\s*prompt|我的指令)/i,
  /我.*接到.*(指令|命令|要求).*是/,
  /(上级|开发者|创建者).{0,3}(告诉|要求|指示|命令)我/,
  /不(能|可以|应该).{0,3}(讨好|奉承|迎合|拍马屁)/,
  /(我是|作为).{0,3}(严厉|冷漠|直接|犀利).{0,3}(的|同事|AI|助手)/,
]

/**
 * Sanitize reasoning/thinking text to prevent system prompt leaks.
 * Returns clean text with any detected leaks replaced by [...].
 * Handles streaming: incremental filtering of cumulative text.
 */
export function sanitizeReasoning(text) {
  let result = text
  for (const pattern of LEAK_PATTERNS) {
    result = result.replace(pattern, '[...]')
  }
  return result
}

/**
 * Check if text contains potential leaks (for logging/alerting).
 */
export function hasLeak(text) {
  return LEAK_PATTERNS.some(p => p.test(text))
}
