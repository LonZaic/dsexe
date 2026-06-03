import { ref } from 'vue'

const zh = {
  brand:'DeepSeek-Super', home:'主页', newChat:'新对话', apiKey:'API Key', email:'邮箱',
  social:'社交', recent:'最近对话', noConvs:'暂无对话', signIn:'请先登录', signOut:'退出',
  morning:'早上好', afternoon:'下午好', evening:'晚上好',
  placeholder:'输入任何内容...', agent:'智能代理', agentDesc:'读写文件、搜索代码、执行命令',
  preview:'实时预览', previewDesc:'HTML/CSS/JS 设计稿实时渲染',
  code:'代码面板', codeDesc:'语法高亮代码，支持复制、下载、预览',
  groupChat:'群聊协作', groupChatDesc:'多人共享空间，Agent 实时协作',
  apiCard:'API Key', apiDesc:'管理 DeepSeek API 凭证', emailCard:'邮箱', emailDesc:'SMTP 通知配置',
  quick:'快速', think:'思考', deep:'深度', v4flash:'V4-Flash', v4pro:'V4-Pro',
  friends:'好友', groups2:'群聊',
  addFriend:'添加', accept:'接受', reject:'拒绝', remove:'删除',
  online:'在线', offline:'离线',
  searchUsers:'搜索用户...', noUsers:'未找到用户', noFriends:'还没有好友',
  pending:'待处理', myFriends:'我的好友', results:'搜索结果',
  createGroup:'创建', joinGroup:'加入', myGroups:'我的群聊', allGroups:'所有群聊',
  groupName:'群名...', inviteCode:'邀请码...', noGroups:'还没有群聊', members:'人',
  back:'返回', send:'发送', dmPlaceholder:'输入消息，@ds 提问...', loading:'加载中...',
  apiModalDesc:'输入 API Key 以使用 AI 和 Agent 功能', saveKey:'保存', keySaved:'已保存到本地',
  emailModalDesc:'配置 SMTP。数据仅存储在本地磁盘。', smtpProvider:'服务商', smtpServer:'服务器', smtpPort:'端口',
  smtpEmail:'邮箱地址', smtpAuth:'授权码', smtpAuthHint:'非登录密码',
  loginTitle:'登录', registerTitle:'注册', loginSub:'登录你的工作空间', registerSub:'创建你的本地账户',
  loginHint:'数据安全存储在本地磁盘', username:'用户名', password:'密码',
  loginBtn:'登录', registerBtn:'注册', toLogin:'已有账号？去登录', toRegister:'没有账号？去注册',
  loginError:'请填写用户名和密码', pleaseWait:'请稍候...',
  chinese:'中文', english:'English',
}

const en = {
  brand:'DeepSeek-Super', home:'Home', newChat:'New Chat', apiKey:'API Key', email:'Email',
  social:'Social', recent:'Recent', noConvs:'No conversations yet', signIn:'Sign in', signOut:'Sign out',
  morning:'Good morning', afternoon:'Good afternoon', evening:'Good evening',
  placeholder:'Ask anything...', agent:'Agent', agentDesc:'Read, write, search, run commands',
  preview:'Live Preview', previewDesc:'HTML/CSS/JS rendered in real-time',
  code:'Code Panel', codeDesc:'Syntax-highlighted with copy, download, preview',
  groupChat:'Group Chat', groupChatDesc:'Multi-agent collaboration in shared spaces',
  apiCard:'API Key', apiDesc:'Manage API credentials', emailCard:'Email', emailDesc:'SMTP notifications',
  quick:'Quick', think:'Think', deep:'Deep', v4flash:'V4-Flash', v4pro:'V4-Pro',
  friends:'Friends', groups2:'Groups',
  addFriend:'Add', accept:'Accept', reject:'Reject', remove:'Remove',
  online:'Online', offline:'Offline',
  searchUsers:'Search users...', noUsers:'No users found', noFriends:'No friends yet',
  pending:'Pending', myFriends:'Friends', results:'Results',
  createGroup:'Create', joinGroup:'Join', myGroups:'My Groups', allGroups:'All Groups',
  groupName:'Group name...', inviteCode:'Invite code...', noGroups:'No groups yet', members:'members',
  back:'Back', send:'Send', dmPlaceholder:'Type a message, @ds to ask AI...', loading:'Loading...',
  apiModalDesc:'Enter API Key to use AI and Agent features.', saveKey:'Save', keySaved:'Saved to disk',
  emailModalDesc:'Configure SMTP. Data stored locally.', smtpProvider:'Provider', smtpServer:'Server', smtpPort:'Port',
  smtpEmail:'Email', smtpAuth:'Auth code', smtpAuthHint:'Not login password',
  loginTitle:'Sign In', registerTitle:'Register', loginSub:'Sign in to your workspace', registerSub:'Create your account',
  loginHint:'Data stored securely on disk', username:'Username', password:'Password',
  loginBtn:'Sign in', registerBtn:'Register', toLogin:'Already have an account?', toRegister:'No account? Create one',
  loginError:'Please enter username and password', pleaseWait:'Please wait...',
  chinese:'中文', english:'English',
}

const lang = ref(localStorage.getItem('ds_lang') || 'zh')

function t(key) { return (lang.value === 'zh' ? zh : en)[key] || key }
function toggleLang() { lang.value = lang.value === 'zh' ? 'en' : 'zh'; localStorage.setItem('ds_lang', lang.value) }

export function useI18n() { return { t, lang, toggleLang } }
