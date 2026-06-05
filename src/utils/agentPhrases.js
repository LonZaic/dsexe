// ═══════════════════════════════════════════
// Agent tool call — entertaining preset phrases
// ═══════════════════════════════════════════

const PHRASES = {
  read: {
    active: [
      '翻阅文件中', '和文件交谈中', '努力读取中', '正在敲文件家的门',
      '仔细阅读每一行', '文件内容加载中', '偷看文件中', '钻研文档中',
      '逐行扫描中', '目光如炬地阅读', '正在理解文件', '埋头苦读中',
      '眼睛盯着屏幕', '一字一句地读', '文件正在被检阅', '拆解文件内容中',
    ],
    done: [
      '翻阅完成', '交谈结束', '文件开门了', '读取完毕',
      '看完了', '文档已阅', '尽收眼底', '读懂了',
      '已掌握内容', '了然于胸', '翻阅完毕', '文件已解密',
    ],
  },
  write: {
    active: [
      '奋笔疾书中', '代码正在诞生', '敲键盘中', '创造中',
      '字迹未干', '正在编织代码', '灵感迸发中', '行云流水',
      '指尖飞舞中', '正在构建新文件', '书写未来', '一字千金',
      '代码如泉涌', '正在雕琢', '妙笔生花中', '笔下生风',
    ],
    done: [
      '写入完成', '代码已落地', '创作完毕', '保存成功',
      '文件已就位', '落笔成文', '新文件诞生', '写入成功',
      '已完成创作', '代码已安家', '文件创建完毕', '大功告成',
    ],
  },
  edit: {
    active: [
      '正在修改中', '精雕细琢中', '修修补补', '润色中',
      '正在调整', '打磨细节中', '微调代码', '优化中',
      '正在改写', '改进进行时', '修饰一番', '正在完善',
    ],
    done: [
      '修改完成', '打磨完毕', '润色结束', '调整到位',
      '优化完成', '已改进', '修缮完毕', '编辑成功',
    ],
  },
  search: {
    active: [
      '四处搜寻中', '放大镜已就位', '地毯式搜索', '正在查找线索',
      '翻箱倒柜中', '正在寻觅', '全网通缉', '大海捞针中',
      '侦探模式启动', '嗅觉灵敏地搜索', '追踪目标中', '正在撒网',
    ],
    done: [
      '搜索完成', '找到了', '目标已锁定', '搜寻完毕',
      '线索已收集', '发现目标', '寻获成功', '搜索结束',
    ],
  },
  run: {
    active: [
      '命令执行中', '正在跑代码', '终端轰鸣中', '火力全开',
      '引擎已启动', '正在发力', '机器运转中', '全力以赴',
      '命令行冲锋中', '正在调度', '全速前进', '执行任务中',
    ],
    done: [
      '命令执行完毕', '运行成功', '任务完成', '顺利跑完',
      '执行结束', '代码跑通了', '终端安静了', '运转完毕',
    ],
  },
  web: {
    active: [
      '正在联网搜索', '向互联网提问', '冲出局域网', '正在网上冲浪',
      '浏览器已打开', '全网检索中', '正在抓取信息', '穿越防火墙',
      '抵达互联网深处', '正在连线外部', '信号已发射', '搜索云端中',
    ],
    done: [
      '网络搜索完成', '信息已抓取', '冲浪归来', '检索完毕',
      '资料已收集', '连线成功', '已获取最新信息', '搜索结束',
    ],
  },
  browse: {
    active: [
      '正在浏览目录', '巡视项目中', '观察文件结构', '一览众山小',
      '目录巡游中', '漫步文件系统', '梳理项目脉络', '正在导航',
    ],
    done: [
      '浏览完毕', '巡视结束', '结构已了解', '一览无余',
      '导读完成', '项目全景已掌握', '导航结束', '浏览完成',
    ],
  },
  list: {
    active: [
      '正在罗列', '清点中', '逐一列举', '正在数数',
      '整理清单中', '排排坐', '列队中', '盘点中',
    ],
    done: [
      '列举完毕', '清单已就绪', '盘点完成', '列队整齐',
      '清点结束', '一览表已生成', '罗列完成', '数清楚了',
    ],
  },
  think: {
    active: [
      '思考中', '大脑运转中', '正在分析', '推敲中',
      '沉思片刻', '琢磨中', '脑力全开', '深入思考中',
    ],
    done: [
      '思考完毕', '分析完成', '已得出结论', '想清楚了',
      '推理结束', '琢磨透了', '见解已形成', '心中有数了',
    ],
  },
  memory: {
    active: [
      '正在回忆', '翻记忆库里', '检索过往', '唤醒记忆中',
      '记忆碎片收集中', '往事浮现', '正在回想', '调取存档中',
    ],
    done: [
      '回忆完毕', '记忆已唤醒', '存档已调取', '往事已记起',
      '记忆检索完成', '已想起', '经验已加载', '回忆成功',
    ],
  },
  compact: {
    active: [
      '正在整理笔记', '压缩上下文中', '精简摘要中', '整理重点',
      '提炼核心内容', '归纳总结中', '压缩信息', '正在打包',
    ],
    done: [
      '整理完成', '压缩完毕', '摘要已生成', '重点已提炼',
      '归纳完成', '打包成功', '上下文已精简', '笔记已整理',
    ],
  },
}

const TOOL_CATEGORY = {
  read_file: 'read',
  write_to_file: 'write',
  write_file: 'write',
  replace_in_file: 'edit',
  edit_file: 'edit',
  search_files: 'search',
  search_file: 'search',
  search_content: 'search',
  glob: 'search',
  grep: 'search',
  execute_command: 'run',
  run_command: 'run',
  bash: 'run',
  web_search: 'web',
  web_fetch: 'web',
  list_files: 'browse',
  list_code_definition_names: 'browse',
  read_lints: 'browse',
  task: 'think',
}

/**
 * Deterministic hash for stable phrase selection
 */
function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * Get a deterministic phrase for a tool category and phase.
 * Same toolName + seed always returns the same phrase.
 * @param {string} toolName - e.g. 'read_file', 'write_file', 'run_command'
 * @param {'active'|'done'} phase
 * @param {string} [seed] - deterministic seed (e.g. tool name)
 * @returns {string}
 */
export function getAgentPhrase(toolName, phase = 'active', seed = '') {
  const category = TOOL_CATEGORY[toolName] || guessCategory(toolName)
  const pool = PHRASES[category]
  if (!pool) return phase === 'active' ? '处理中' : '完成'
  const phrases = pool[phase] || pool.active
  // Use deterministic hash from tool name + seed to pick a stable phrase
  const key = seed || toolName
  const idx = hashStr(key) % phrases.length
  return phrases[idx]
}

function guessCategory(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('read') || n.includes('cat') || n.includes('open')) return 'read'
  if (n.includes('write') || n.includes('create') || n.includes('save')) return 'write'
  if (n.includes('edit') || n.includes('modify') || n.includes('replace')) return 'edit'
  if (n.includes('search') || n.includes('find') || n.includes('grep') || n.includes('glob')) return 'search'
  if (n.includes('run') || n.includes('exec') || n.includes('bash') || n.includes('cmd') || n.includes('shell')) return 'run'
  if (n.includes('web') || n.includes('fetch') || n.includes('http')) return 'web'
  if (n.includes('list') || n.includes('ls') || n.includes('dir')) return 'list'
  if (n.includes('browse') || n.includes('tree') || n.includes('explore')) return 'browse'
  if (n.includes('think') || n.includes('reason') || n.includes('analyze')) return 'think'
  return 'think'
}
