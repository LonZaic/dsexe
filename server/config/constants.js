// ══════════════════════════════════════
// DeepSeek-Super Constants
// ══════════════════════════════════════

module.exports = {
  // Agent limits
  MAX_ROUNDS_BEFORE_COMPACT: 40,
  TOOL_TIMEOUT_MS: 30000,
  AGENT_TIMEOUT_MS: 600000,
  MAX_FILE_SIZE: 500 * 1024, // 500KB

  // API defaults
  DEFAULT_MODEL: 'deepseek-v4-pro',
  DEFAULT_FAST_MODEL: 'deepseek-v4-flash',
  DEFAULT_MAX_TOKENS: 8192,
  DEFAULT_TEMPERATURE: 0.3,

  // Thinking depth presets
  THINKING_PRESETS: {
    low: { temperature: 0.7, max_tokens: 1024 },
    medium: { temperature: 0.3, max_tokens: 4096 },
    high: { temperature: 0.1, max_tokens: 8192 },
  },

  // System protected directories
  PROTECTED_DIRS: process.platform === 'win32' ? [
    'C:\\Windows', 'C:\\Windows\\System32', 'C:\\Windows\\SysWOW64',
    'C:\\Program Files', 'C:\\Program Files (x86)',
    'C:\\ProgramData\\Microsoft', 'C:\\System Volume Information',
    'C:\\$Recycle.Bin',
  ] : [
    '/System', '/etc', '/boot', '/usr/lib', '/usr/bin', '/sbin', '/bin',
  ],

  // API base URL
  DEEPSEEK_API_BASE: 'https://api.deepseek.com/v1/chat/completions',

  // Permission modes
  PERMISSION_MODES: ['default', 'plan', 'acceptEdits', 'bypass'],
}
