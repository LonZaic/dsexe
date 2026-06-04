import { ref, computed } from 'vue'

// ═══════════════════════════════════════════
// Language metadata
// ═══════════════════════════════════════════

const LANG_META = [
  { code: 'zh-CN', native: '简体中文',     en: 'Simplified Chinese' },
  { code: 'zh-HK', native: '繁體中文（港澳地區）', en: 'Traditional Chinese (HK/MO China)' },
  { code: 'zh-TW', native: '繁體中文（台灣地區）', en: 'Traditional Chinese (TW China)' },
  { code: 'en',    native: 'English',         en: 'English' },
]

// ═══════════════════════════════════════════
// All translations — zh-CN / zh-HK / zh-TW / en
// HK = 港澳繁體 (Cantonese-influenced)
// TW = 台灣正體 (Mandarin-influenced)
// API Key 保持英文不變
// ═══════════════════════════════════════════

const L = {

  // ── Brand & Nav ──
  brand:           ['DeepSeek-Super', 'DeepSeek-Super', 'DeepSeek-Super', 'DeepSeek-Super'],
  home:            ['聊天', '聊天', '聊天', 'Chat'],
  newChat:         ['新对话', '新對話', '新對話', 'New Chat'],
  apiKey:          ['API Key', 'API Key', 'API Key', 'API Key'],
  email:           ['邮箱', '電郵', '電子郵件', 'Email'],
  social:          ['社交', '社交', '社交', 'Social'],
  recent:          ['最近对话', '最近對話', '最近對話', 'Recent'],
  noConvs:         ['暂无对话', '暫無對話', '暫無對話', 'No conversations yet'],
  signIn:          ['请先登录', '請先登入', '請先登入', 'Sign in'],
  signOut:         ['退出', '登出', '登出', 'Sign out'],

  // ── Greeting ──
  morning:         ['早上好', '早晨', '早安', 'Good morning'],
  afternoon:       ['下午好', '午安', '午安', 'Good afternoon'],
  evening:         ['晚上好', '晚安', '晚安', 'Good evening'],

  // ── Home Feature Cards ──
  agentMode:       ['智能代理', '智能代理', '智慧代理', 'Agent Mode'],
  agentModeDesc:   ['读写文件、搜索代码、执行命令 — 全自主', '讀寫檔案、搜尋程式碼、執行命令 — 全自主', '讀寫檔案、搜尋程式碼、執行命令 — 全自主', 'Read, write, search, run commands — full autonomy'],
  livePreview:     ['实时预览', '即時預覽', '即時預覽', 'Live Preview'],
  livePreviewDesc: ['HTML/CSS/JS 设计稿实时渲染', 'HTML/CSS/JS 設計稿即時渲染', 'HTML/CSS/JS 設計稿即時渲染', 'HTML/CSS/JS designs rendered in real-time'],
  codePanel:       ['代码面板', '程式碼面板', '程式碼面板', 'Code Panel'],
  codePanelDesc:   ['语法高亮代码，支持复制、下载、预览', '語法高亮程式碼，支援複製、下載、預覽', '語法高亮程式碼，支援複製、下載、預覽', 'Syntax-highlighted with copy, download, preview'],
  groupChatTitle:  ['群聊协作', '群組協作', '群組協作', 'Group Chat'],
  groupChatDesc:   ['多人共享空间，Agent 实时协作', '多人共享空間，Agent 即時協作', '多人共享空間，Agent 即時協作', 'Multi-agent collaboration in shared spaces'],
  apiCard:         ['API Key', 'API Key', 'API Key', 'API Key'],
  apiCardDesc:     ['管理 DeepSeek API 凭证', '管理 DeepSeek API 憑證', '管理 DeepSeek API 憑證', 'Manage DeepSeek API credentials'],
  emailCard:       ['邮箱', '電郵', '電子郵件', 'Email'],
  emailCardDesc:   ['SMTP 通知配置', 'SMTP 通知設定', 'SMTP 通知設定', 'SMTP notification setup'],

  // ── Input / Chat ──
  placeholder:     ['输入任何内容...', '輸入任何內容...', '輸入任何內容...', 'Ask anything...'],
  askPlaceholder:  ['输入任何内容，输入 / 使用命令...', '輸入任何內容，輸入 / 使用命令...', '輸入任何內容，輸入 / 使用命令...', 'Ask anything, or type / for commands...'],
  send:            ['发送', '發送', '傳送', 'Send'],
  stopGen:         ['停止生成', '停止生成', '停止生成', 'Stop generation'],
  sendMsg:         ['发送消息', '發送訊息', '傳送訊息', 'Send message'],
  addContext:      ['添加上下文', '加入內容', '加入內容', 'Add context'],
  uploadFile:      ['上传文件', '上載檔案', '上傳檔案', 'Upload file'],
  screenshot:      ['截图', '擷取畫面', '擷取畫面', 'Screenshot'],
  connectGithub:   ['连接 GitHub', '連接 GitHub', '連接 GitHub', 'Connect GitHub'],
  webSearch:       ['联网搜索', '聯網搜尋', '聯網搜尋', 'Web search'],
  thinkingDepth:   ['思考深度', '思考深度', '思考深度', 'Thinking depth'],
  changeModel:     ['切换模型', '切換模型', '切換模型', 'Change model'],

  // ── Thinking & Model Labels ──
  quick:           ['快速', '快速', '快速', 'Quick'],
  think:           ['思考', '思考', '思考', 'Think'],
  deep:            ['深度', '深度', '深度', 'Deep'],
  v4flash:         ['V4-Flash', 'V4-Flash', 'V4-Flash', 'V4-Flash'],
  v4pro:           ['V4-Pro', 'V4-Pro', 'V4-Pro', 'V4-Pro'],

  // ── Agent Panel ──
  agent:           ['智能代理', '智能代理', '智慧代理', 'Agent'],
  agentDesc:       ['读写文件、搜索代码、执行命令', '讀寫檔案、搜尋程式碼、執行命令', '讀寫檔案、搜尋程式碼、執行命令', 'Read, write, search, run commands'],
  agentError:      ['出错了', '出錯了', '發生錯誤', 'Error'],
  agentAborted:    ['已暂停', '已暫停', '已暫停', 'Aborted'],
  agentComplete:   ['完成', '完成', '完成', 'Complete'],
  agentAnalyzing:  ['分析任务...', '分析任務...', '分析任務...', 'Analyzing task...'],
  agentUnderstanding: ['正在了解项目...', '正在了解專案...', '正在了解專案...', 'Understanding project...'],
  agentBrowsing:   ['正在浏览文件...', '正在瀏覽檔案...', '正在瀏覽檔案...', 'Browsing files...'],
  agentReading:    ['正在读取...', '正在讀取...', '正在讀取...', 'Reading...'],
  agentWriting:    ['正在创建...', '正在建立...', '正在建立...', 'Writing...'],
  agentEditing:    ['正在编辑...', '正在編輯...', '正在編輯...', 'Editing...'],
  agentSearching:  ['正在搜索...', '正在搜尋...', '正在搜尋...', 'Searching...'],
  agentSearchingCode: ['搜索代码中...', '搜尋程式碼中...', '搜尋程式碼中...', 'Searching code...'],
  agentRunning:    ['执行命令中...', '執行命令中...', '執行命令中...', 'Running command...'],
  agentWebSearch:  ['搜索网络中...', '搜尋網絡中...', '搜尋網路中...', 'Searching web...'],
  agentProcessing: ['正在处理...', '正在處理...', '正在處理...', 'Processing...'],
  agentDone:       ['任务完成', '任務完成', '任務完成', 'Task completed'],
  agentThinking:    ['正在思考中...', '正在思考中...', '正在思考中...', 'Thinking...'],
  agentInterrupted: ['任务中断', '任務中斷', '任務中斷', 'Task Interrupted'],
  agentInterruptedDesc: ['Agent 工作被中断，任务未完成', 'Agent 工作被中斷，任務未完成', 'Agent 工作被中斷，任務未完成', 'Agent was interrupted, task incomplete'],
  agentSummary:     ['任务总结', '任務總結', '任務總結', 'Summary'],
  agentRound:      ['轮', '輪', '輪', 'rounds'],
  agentRounds:     ['轮数', '輪數', '輪數', 'Rounds'],
  agentHooks:      ['钩子', '掛鉤', '鉤子', 'Hooks'],
  agentMemories:   ['记忆', '記憶', '記憶', 'Memories'],
  agentCompacting: ['压缩上下文中...', '壓縮上下文中...', '壓縮上下文中...', 'Compacting...'],
  agentCompacted:  ['压缩完成', '壓縮完成', '壓縮完成', 'Compaction done'],
  agentBudget:     ['预算', '預算', '預算', 'Budget'],
  agentBlocked:    ['已拦截', '已攔截', '已攔截', 'Blocked'],
  agentMemoryFound: ['回忆', '回憶', '回憶', 'Recall'],
  agentMemorySaved: ['已记忆', '已記憶', '已記憶', 'Memorized'],
  agentLoop:       ['循环', '迴圈', '迴圈', 'Loop'],

  // Agent tool action labels
  actListing:      ['列举中...', '列舉中...', '列舉中...', 'Listing...'],
  actReading:      ['读取中...', '讀取中...', '讀取中...', 'Reading...'],
  actWriting:      ['写入中...', '寫入中...', '寫入中...', 'Writing...'],
  actEditing:      ['编辑中...', '編輯中...', '編輯中...', 'Editing...'],
  actFinding:      ['搜索中...', '搜尋中...', '搜尋中...', 'Finding...'],
  actSearching:    ['查找中...', '尋找中...', '尋找中...', 'Searching...'],
  actRunning:      ['执行中...', '執行中...', '執行中...', 'Running...'],
  actWebSearching: ['搜索网络...', '搜尋網絡...', '搜尋網路...', 'Searching web...'],
  actBrowse:       ['浏览', '瀏覽', '瀏覽', 'Browse'],
  actRead:         ['读取', '讀取', '讀取', 'Read'],
  actWrite:        ['写入', '寫入', '寫入', 'Write'],
  actEdit:         ['编辑', '編輯', '編輯', 'Edit'],
  actSearch:       ['搜索', '搜尋', '搜尋', 'Search'],
  actFind:         ['查找', '尋找', '尋找', 'Find'],
  actRun:          ['执行', '執行', '執行', 'Run'],
  actWeb:          ['联网', '聯網', '聯網', 'Web'],

  // ── Message Actions ──
  regenerate:      ['重新生成', '重新生成', '重新生成', 'Regenerate'],
  copy:            ['复制', '複製', '複製', 'Copy'],
  editMsg:         ['编辑', '編輯', '編輯', 'Edit'],
  delete:          ['删除', '刪除', '刪除', 'Delete'],
  prevVersion:     ['上一版本', '上一版本', '上一版本', 'Previous'],
  nextVersion:     ['下一版本', '下一版本', '下一版本', 'Next'],

  // ── Thinking / Reasoning ──
  thinkingProcess: ['思考过程', '思考過程', '思考過程', 'Thinking process'],
  viewGenProcess:  ['查看生成过程', '檢視生成過程', '檢視生成過程', 'View generation process'],

  // ── Design / Preview ──
  drawing:         ['绘制中...', '繪製中...', '繪製中...', 'Drawing...'],
  drawComplete:    ['绘制完成', '繪製完成', '繪製完成', 'Drawing complete'],
  thinkComplete:   ['思考完成', '思考完成', '思考完成', 'Thinking complete'],
  thinkingDots:    ['思考中...', '思考中...', '思考中...', 'Thinking...'],
  export:          ['导出', '匯出', '匯出', 'Export'],
  phone:           ['手机', '手機', '手機', 'Phone'],
  tablet:          ['平板', '平板', '平板', 'Tablet'],
  desktop:         ['电脑', '電腦', '電腦', 'Desktop'],
  device:          ['设备', '裝置', '裝置', 'Device'],

  // ── Friends & Groups (SocialView) ──
  friends:         ['好友', '好友', '好友', 'Friends'],
  groups2:         ['群聊', '群組', '群組', 'Groups'],
  addFriend:       ['添加', '新增', '新增', 'Add'],
  accept:          ['接受', '接受', '接受', 'Accept'],
  reject:          ['拒绝', '拒絕', '拒絕', 'Reject'],
  remove:          ['删除', '刪除', '刪除', 'Remove'],
  online:          ['在线', '在線', '線上', 'Online'],
  offline:         ['离线', '離線', '離線', 'Offline'],
  searchUsers:     ['搜索用户...', '搜尋用戶...', '搜尋使用者...', 'Search users...'],
  noUsers:         ['未找到用户', '未找到用戶', '未找到使用者', 'No users found'],
  noFriends:       ['还没有好友', '尚未有好友', '尚未有好友', 'No friends yet'],
  pending:         ['待处理', '待處理', '待處理', 'Pending'],
  myFriends:       ['我的好友', '我的好友', '我的好友', 'My Friends'],
  results:         ['搜索结果', '搜尋結果', '搜尋結果', 'Results'],
  createGroup:     ['创建', '建立', '建立', 'Create'],
  joinGroup:       ['加入', '加入', '加入', 'Join'],
  myGroups:        ['我的群聊', '我的群組', '我的群組', 'My Groups'],
  allGroups:       ['所有群聊', '所有群組', '所有群組', 'All Groups'],
  groupName:       ['群名...', '群組名稱...', '群組名稱...', 'Group name...'],
  inviteCode:      ['邀请码...', '邀請碼...', '邀請碼...', 'Invite code...'],
  noGroups:        ['还没有群聊', '尚未有群組', '尚未有群組', 'No groups yet'],
  members:         ['人', '人', '人', 'members'],

  // ── DM ──
  back:            ['返回', '返回', '返回', 'Back'],
  dmPlaceholder:   ['输入消息，@ds 提问...', '輸入訊息，@ds 提問...', '輸入訊息，@ds 提問...', 'Type a message, @ds to ask AI...'],
  loading:         ['加载中...', '載入中...', '載入中...', 'Loading...'],
  me:              ['我', '我', '我', 'Me'],

  // ── Group Chat ──
  leaveGroup:      ['退出群聊', '退出群組', '退出群組', 'Leave group'],
  leaveConfirm:    ['确定退出群聊？', '確定退出群組？', '確定退出群組？', 'Leave this group?'],
  dsThinking:      ['思考中...', '思考中...', '思考中...', 'Thinking...'],

  // ── Settings Modal ──
  apiModalTitle:   ['API Key', 'API Key', 'API Key', 'API Key'],
  apiModalSub:     ['输入你的 DeepSeek API 密钥以使用 AI 和智能代理功能。', '輸入你的 DeepSeek API 密鑰以使用 AI 同智能代理功能。', '輸入你的 DeepSeek API 金鑰以使用 AI 與智慧代理功能。', 'Enter your DeepSeek API key to start using the agent and AI features.'],
  showKey:         ['显示', '顯示', '顯示', 'Show'],
  hideKey:         ['隐藏', '隱藏', '隱藏', 'Hide'],
  saveApiKey:      ['保存 API Key', '儲存 API Key', '儲存 API Key', 'Save API Key'],
  apiKeySaved:     ['API Key 已保存到本地', 'API Key 已儲存到本機', 'API Key 已儲存到本機', 'API Key saved to local disk'],
  cloudKey:        ['使用云端 Key', '使用雲端 Key', '使用雲端 Key', 'Use cloud key'],
  cloudKeyDesc:    ['已预填，即开即用，无需配置', '已預填，即開即用，無需配置', '已預填，即開即用，無需配置', 'Pre-configured, ready to use'],
  ownKey:          ['使用自己的 Key', '使用自己的 Key', '使用自己的 Key', 'Use my own key'],
  ownKeyDesc:      ['填入你的 DeepSeek API Key', '填入你的 DeepSeek API Key', '填入你的 DeepSeek API Key', 'Enter your DeepSeek API Key'],
  fillApiKey:      ['请先填写 API Key', '請先填寫 API Key', '請先填寫 API Key', 'Please fill in your API Key'],

  emailModalTitle: ['邮箱（SMTP）', '電郵（SMTP）', '電子郵件（SMTP）', 'Email (SMTP)'],
  emailModalSub:   ['配置 SMTP 以接收通知。数据仅存储在本地磁盘。', '設定 SMTP 以接收通知。資料僅儲存於本機磁碟。', '設定 SMTP 以接收通知。資料僅儲存於本機磁碟。', 'Configure SMTP to receive notifications. Data stored on your local disk only.'],
  smtpProvider:    ['服务商', '服務商', '服務商', 'Provider'],
  smtpServer:      ['服务器', '伺服器', '伺服器', 'Server'],
  smtpPort:        ['端口', '連接埠', '連接埠', 'Port'],
  smtpEmail:       ['邮箱地址', '電郵地址', '電子郵件地址', 'Email address'],
  smtpAuth:        ['授权码', '授權碼', '授權碼', 'Auth code'],
  smtpAuthHint:    ['非登录密码', '非登入密碼', '非登入密碼', 'Not login password'],
  saveSMTP:        ['保存 SMTP', '儲存 SMTP', '儲存 SMTP', 'Save SMTP'],
  smtpSaved:       ['SMTP 已保存', 'SMTP 已儲存', 'SMTP 已儲存', 'SMTP saved'],
  settingsTitle:   ['设置', '設定', '設定', 'Settings'],
  settingsSub:     ['从侧边栏选择一个分类进行配置。', '從側邊欄選擇一個分類進行設定。', '從側邊欄選擇一個分類進行設定。', 'Select a category from the sidebar to configure.'],
  custom:          ['自定义', '自訂', '自訂', 'Custom'],

  // ── Data Export/Import ──
  dataTabTitle:    ['数据管理', '數據管理', '資料管理', 'Data Management'],
  dataTabSub:      ['导出对话数据到本地文件，或从文件导入以恢复历史记录。', '匯出對話資料到本機檔案，或從檔案匯入以恢復歷史記錄。', '匯出對話資料到本機檔案，或從檔案匯入以恢復歷史記錄。', 'Export conversation data to a local file, or import from a file to restore history.'],
  exportData:      ['导出数据', '匯出數據', '匯出資料', 'Export data'],
  importData:      ['导入数据', '匯入數據', '匯入資料', 'Import data'],
  exporting:       ['导出中...', '匯出中...', '匯出中...', 'Exporting...'],
  exportSuccess:   ['导出成功', '匯出成功', '匯出成功', 'Export successful'],
  exportError:     ['导出失败', '匯出失敗', '匯出失敗', 'Export failed'],
  importSuccess:   ['成功导入 {n} 个对话', '成功匯入 {n} 個對話', '成功匯入 {n} 個對話', 'Successfully imported {n} conversations'],
  importError:     ['导入失败', '匯入失敗', '匯入失敗', 'Import failed'],
  importInvalid:   ['无效的导入文件：缺少 conversations 数组', '無效的匯入檔案：缺少 conversations 陣列', '無效的匯入檔案：缺少 conversations 陣列', 'Invalid import file: missing conversations array'],

  // ── Login Page ──
  loginTitle:      ['登录', '登入', '登入', 'Sign In'],
  registerTitle:   ['注册', '註冊', '註冊', 'Register'],
  loginSub:        ['登录你的工作空间', '登入你嘅工作空間', '登入你的工作空間', 'Sign in to your workspace'],
  registerSub:     ['创建你的本地账户', '建立你嘅本機帳戶', '建立你的本機帳戶', 'Create your local account'],
  username:        ['用户名', '用戶名', '使用者名稱', 'Username'],
  password:        ['密码', '密碼', '密碼', 'Password'],
  loginBtn:        ['登录', '登入', '登入', 'Sign in'],
  registerBtn:     ['注册', '註冊', '註冊', 'Register'],
  createAccount:   ['创建账户', '建立帳戶', '建立帳戶', 'Create account'],
  toLogin:         ['已有账号？去登录', '已有帳號？去登入', '已有帳號？去登入', 'Already have an account? Sign in'],
  toRegister:      ['没有账号？去注册', '未有帳號？去註冊', '未有帳號？去註冊', 'No account? Create one'],
  loginError:      ['请填写用户名和密码', '請填寫用戶名同密碼', '請填寫使用者名稱與密碼', 'Please enter username and password'],
  pleaseWait:      ['请稍候...', '請稍候...', '請稍候...', 'Please wait...'],

  // ── Language Selector ──
  chinese:         ['简体中文', '簡體中文', '簡體中文', 'Simplified Chinese'],
  chineseHK:       ['繁體中文（港澳地區）', '繁體中文（港澳地區）', '繁體中文（港澳地區）', 'Traditional Chinese (HK/MO China)'],
  chineseTW:       ['繁體中文（台灣地區）', '繁體中文（台灣地區）', '繁體中文（台灣地區）', 'Traditional Chinese (TW China)'],
  english:         ['English', 'English', 'English', 'English'],
  switchLang:      ['切换语言', '切換語言', '切換語言', 'Language'],

  // ── Misc ──
  newChatTab:      ['新对话', '新對話', '新對話', 'New Chat'],
  apiNotSet:       ['请先设置 API Key', '請先設定 API Key', '請先設定 API Key', 'Please set API Key first'],
  ok:              ['确定', '確定', '確定', 'OK'],
  cancel:          ['取消', '取消', '取消', 'Cancel'],
  close:           ['关闭', '關閉', '關閉', 'Close'],
  searchConvs:     ['搜索对话...', '搜尋對話...', '搜尋對話...', 'Search conversations...'],
  rename:          ['重命名', '重命名', '重命名', 'Rename'],
  deleteConv:      ['删除对话', '刪除對話', '刪除對話', 'Delete conversation'],
  confirmDeleteQ:  ['确定删除', '確定刪除', '確定刪除', 'Delete'],
  cannotUndo:      ['删除后无法恢复', '刪除後無法恢復', '刪除後無法恢復', 'This cannot be undone'],
  noMatchConvs:    ['无匹配对话', '無匹配對話', '無匹配對話', 'No matching conversations'],
  selectDevice:    ['选择设备：', '選擇裝置：', '選擇裝置：', 'Select device:'],
  copyCode:        ['复制代码', '複製程式碼', '複製程式碼', 'Copy code'],
  downloadFile:    ['下载文件', '下載檔案', '下載檔案', 'Download file'],
  previewCode:     ['预览', '預覽', '預覽', 'Preview'],
  showCode:        ['显示代码', '顯示程式碼', '顯示程式碼', 'Show code'],
  expand:          ['展开', '展開', '展開', 'Expand'],
  codeN:           ['代码', '程式碼', '程式碼', 'Code'],
  linesUnit:       ['行', '行', '行', 'lines'],
  groupPeople:     ['人', '人', '人', 'people'],
  dsAiName:        ['DS', 'DS', 'DS', 'DS'],
  tagMe:           ['我', '我', '我', 'Me'],
  apiNotSetMsg:    ['请先在首页设置 API Key', '請先喺首頁設定 API Key', '請先在首頁設定 API Key', 'Please set API Key on the home page first'],
  agentDoneMsg:    ['任务完成', '任務完成', '任務完成', 'Task completed'],
  agentErrorMsg:   ['Agent 出错', 'Agent 出錯', 'Agent 發生錯誤', 'Agent error'],
  requestFailed:   ['请求失败', '請求失敗', '請求失敗', 'Request failed'],
  somethingWrong:  ['出了点问题', '出咗啲問題', '出了點問題', 'Something went wrong'],
  systemPrompt:    ['你在一个私聊对话中。根据上下文回答，简洁有用。', '你喺一個私聊對話入面。根據上下文回答，簡潔有用。', '你在一個私聊對話中。根據上下文回答，簡潔有用。', 'You are in a private chat. Answer concisely and helpfully based on context.'],
  systemPromptGroup: ['你在开发者群聊中。简洁专业地回答问题，用中文。', '你喺開發者群組入面。簡潔專業咁回答問題，用中文。', '你在開發者群聊中。簡潔專業地回答問題，用中文。', 'You are in a developer group chat. Answer concisely and professionally.'],
  viewPanel:       ['（查看面板）', '（檢視面板）', '（檢視面板）', ' (view panel)'],
}

// ═══════════════════════════════════════════
// Build locale maps from the L matrix
// ═══════════════════════════════════════════

const CODES = ['zh-CN', 'zh-HK', 'zh-TW', 'en']
const IDX = { 'zh-CN': 0, 'zh-HK': 1, 'zh-TW': 2, 'en': 3 }

const locales = {}
for (const code of CODES) {
  const idx = IDX[code]
  locales[code] = {}
  for (const key of Object.keys(L)) {
    locales[code][key] = L[key][idx]
  }
}

// ═══════════════════════════════════════════
// Reactive state
// ═══════════════════════════════════════════

const stored = localStorage.getItem('ds_lang')
const defaultLang = CODES.includes(stored) ? stored : 'zh-CN'
const lang = ref(defaultLang)

// ═══════════════════════════════════════════
// API
// ═══════════════════════════════════════════

function t(key) {
  const dict = locales[lang.value]
  if (!dict) return key
  return dict[key] || key
}

function setLang(code) {
  if (!CODES.includes(code)) return
  lang.value = code
  localStorage.setItem('ds_lang', code)
}

// Get display name for a language in the current language
function langDisplay(code) {
  const meta = LANG_META.find(m => m.code === code)
  if (!meta) return code
  // In Chinese locales, show native names; in English, show English names
  if (lang.value === 'en') return meta.en
  return meta.native
}

// Available languages with display names (reactive computed)
function availableLangs() {
  return LANG_META.map(m => ({
    code: m.code,
    label: langDisplay(m.code),
  }))
}

// Convenience: quick check helpers
const isZh = computed(() => lang.value.startsWith('zh'))
const isEn = computed(() => lang.value === 'en')

export function useI18n() {
  return {
    t,
    lang,
    setLang,
    availableLangs,
    langDisplay,
    LANG_META,
    CODES,
    isZh,
    isEn,
  }
}
