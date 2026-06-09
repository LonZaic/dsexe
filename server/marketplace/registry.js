// ═══════════════════════════════════════════
// Marketplace Registry — MCP + Skills
// ═══════════════════════════════════════════

const MCP_SERVERS = [
  {
    id: 'github',
    name: 'GitHub',
    description: '管理 Issues、PR、仓库搜索，GitHub 全平台集成',
    longDescription: '完整的 GitHub 平台集成。创建和管理 Issues、Pull Requests，搜索代码，浏览仓库，管理工作流。',
    icon: 'github',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<your-github-token>' },
    tags: ['git', '开发', '协作'],
    category: 'development',
    official: true,
    installs: 125000,
    version: '1.0.0',
  },
  {
    id: 'filesystem',
    name: '文件系统',
    description: '安全的文件系统操作，可配置访问边界',
    longDescription: '为 AI 提供受控的文件系统访问。配置允许的目录后，AI 可在边界内读写、移动和搜索文件。',
    icon: 'folder',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    tags: ['文件', '系统', '工具'],
    category: 'system',
    official: true,
    installs: 89000,
    version: '1.0.0',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: '数据库查询和 Schema 浏览',
    longDescription: '连接 PostgreSQL 数据库，浏览表结构，运行只读查询，分析数据。支持连接字符串和 SSL。',
    icon: 'database',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', '<connection-string>'],
    tags: ['数据库', 'SQL', '数据'],
    category: 'database',
    official: true,
    installs: 67000,
    version: '1.0.0',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'SQLite 数据库查询和分析',
    longDescription: '查询、分析和浏览 SQLite 数据库文件。适合本地开发、数据分析和嵌入式数据库场景。',
    icon: 'database',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '<path-to-db-file>'],
    tags: ['数据库', 'SQLite', '数据'],
    category: 'database',
    official: true,
    installs: 45000,
    version: '1.0.0',
  },
  {
    id: 'brave-search',
    name: 'Brave 搜索',
    description: '通过 Brave Search API 进行网络搜索',
    longDescription: '集成 Brave Search API，支持网页搜索、新闻搜索和本地商家搜索。返回结构化结果。',
    icon: 'search',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '<your-brave-api-key>' },
    tags: ['搜索', '网络', '研究'],
    category: 'search',
    official: true,
    installs: 52000,
    version: '1.0.0',
  },
  {
    id: 'memory',
    name: '知识图谱记忆',
    description: '基于知识图谱的持久记忆系统',
    longDescription: '使用知识图谱结构提供跨会话的持久记忆。实体和关系存储在图数据库中，AI 能记住事实、实体和对话间的关系。',
    icon: 'memory',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    tags: ['记忆', '图谱', '持久化'],
    category: 'utility',
    official: true,
    installs: 38000,
    version: '1.0.0',
  },
  {
    id: 'puppeteer',
    name: '浏览器自动化',
    description: '无头浏览器：网页抓取和截图',
    longDescription: '控制无头浏览器进行网页抓取、截图、Web 应用测试和自动化工作流。',
    icon: 'browser',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    tags: ['浏览器', '自动化', '测试'],
    category: 'tools',
    official: true,
    installs: 56000,
    version: '1.0.0',
  },
  {
    id: 'docker',
    name: 'Docker',
    description: '容器管理和 Docker 操作',
    longDescription: '管理 Docker 容器、镜像、卷和网络。启动、停止、检查容器，构建镜像，管理 Docker Compose 栈。',
    icon: 'container',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-docker'],
    tags: ['Docker', '容器', '运维'],
    category: 'devops',
    official: false,
    installs: 21000,
    version: '1.0.0',
  },
  {
    id: 'weather',
    name: '天气查询',
    description: '实时天气数据和预报',
    longDescription: '通过 OpenWeatherMap API 获取全球实时天气、预报和历史数据。',
    icon: 'weather',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-weather'],
    env: { OPENWEATHER_API_KEY: '<your-api-key>' },
    tags: ['天气', '数据', '工具'],
    category: 'data',
    official: false,
    installs: 18000,
    version: '1.0.0',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack 工作空间集成 — 消息与频道',
    longDescription: '发送和读取 Slack 消息，管理频道，搜索对话，将 AI 集成到团队沟通工作流中。',
    icon: 'chat',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-slack'],
    env: { SLACK_BOT_TOKEN: '<your-slack-token>' },
    tags: ['Slack', '沟通', '团队'],
    category: 'communication',
    official: false,
    installs: 31000,
    version: '1.0.0',
  },
  // ─── New additions ───
  {
    id: 'fetch',
    name: '网页抓取',
    description: '将网页内容转为 Markdown，AI 可直接阅读',
    longDescription: '抓取任意 URL 的网页内容，自动转换为 Markdown 格式，让 AI 能够直接理解和处理网页信息。支持自定义 User-Agent。',
    icon: 'fetch',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    tags: ['网页', '抓取', 'Markdown'],
    category: 'tools',
    official: true,
    installs: 72000,
    version: '1.0.0',
  },
  {
    id: 'sequential-thinking',
    name: '结构化思考',
    description: '多步骤推理引擎，增强复杂问题分析',
    longDescription: '通过链式思维进行多步骤推理。AI 可以生成、修正和迭代思考步骤，适合数学证明、逻辑推理、复杂决策等场景。',
    icon: 'thinking',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    tags: ['推理', '思考', '逻辑'],
    category: 'tools',
    official: true,
    installs: 61000,
    version: '1.0.0',
  },
  {
    id: 'time',
    name: '时间工具',
    description: '时区转换、时间计算、定时提醒',
    longDescription: '获取当前时间（任意时区）、转换时区、计算时间差、设置定时提醒。支持全球所有时区。',
    icon: 'time',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-time'],
    tags: ['时间', '时区', '工具'],
    category: 'utility',
    official: false,
    installs: 35000,
    version: '1.0.0',
  },
  {
    id: 'git-local',
    name: 'Git 本地操作',
    description: '本地 Git 仓库管理：日志、分支、差异',
    longDescription: '直接操作本地 Git 仓库。查看日志、切换分支、查看差异、暂存文件、提交更改。支持所有标准 Git 操作。',
    icon: 'git',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-git', '--repository', '<path-to-repo>'],
    tags: ['Git', '版本控制', '开发'],
    category: 'development',
    official: false,
    installs: 42000,
    version: '1.0.0',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notion 工作空间：页面、数据库、搜索',
    longDescription: '集成 Notion API。创建和编辑页面、查询数据库、搜索工作空间内容。需要 Notion Integration Token。',
    icon: 'notion',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-notion'],
    env: { NOTION_API_KEY: '<your-notion-token>' },
    tags: ['Notion', '文档', '知识库'],
    category: 'productivity',
    official: false,
    installs: 28000,
    version: '1.0.0',
  },
  {
    id: 'exa-search',
    name: 'Exa 搜索',
    description: 'AI 原生搜索引擎，语义搜索网页',
    longDescription: '使用 Exa API 进行语义搜索和内容抓取。支持自然语言查询、相似页面发现、自动内容提取。比传统关键词搜索更精准。',
    icon: 'search',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-exa'],
    env: { EXA_API_KEY: '<your-exa-api-key>' },
    tags: ['搜索', '语义', 'AI'],
    category: 'search',
    official: false,
    installs: 24000,
    version: '1.0.0',
  },
]

const SKILLS = [
  {
    id: 'commit',
    name: 'commit',
    displayName: '智能提交',
    description: '分析暂存改动，生成规范的 Conventional Commits 提交信息',
    icon: 'commit',
    author: 'deepseek-super',
    category: 'development',
    tags: ['git', '提交', '开发'],
    official: true,
    installs: 50000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: commit
description: 分析暂存改动并生成规范的 Conventional Commits 提交信息
allowed-tools: Bash(git:*), Read, Grep
model: inherit
user-invocable: true
argument-hint: "[提交信息的额外上下文]"
---

你是 Git 提交信息生成器。遵循 Conventional Commits 规范。

## 工作流程
1. 用 \`git diff --staged --stat\` 查看变更文件
2. 用 \`git diff --staged\` 查看详细差异
3. 生成一条规范的提交信息
4. 执行 \`git commit -m "信息"\`

## 格式
类型(范围): 描述
类型: feat/fix/docs/style/refactor/perf/test/chore/ci`,
  },
  {
    id: 'review',
    name: 'review',
    displayName: '代码审查',
    description: '多维度代码审查：Bug、安全、性能、架构',
    icon: 'review',
    author: 'deepseek-super',
    category: 'development',
    tags: ['审查', '代码', '质量'],
    official: true,
    installs: 43000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: review
description: 多维度代码审查，查找 Bug、安全漏洞、性能问题和架构缺陷
allowed-tools: Bash(git:*), Read, Grep, Glob
model: inherit
user-invocable: true
argument-hint: "[文件路径或 PR 描述]"
---

你是资深代码审查员。审查改动的四个维度：

## 审查维度
- **Bug**: 逻辑错误、边界条件、竞态条件
- **安全**: 注入风险、认证绕过、密钥泄露
- **性能**: N+1 查询、内存泄漏、阻塞操作
- **架构**: 设计模式、耦合度、内聚性

## 输出格式
每条问题：文件:行号 | 严重度(严重/高/中/低) | 类别 | 问题描述 | 修复建议`,
  },
  {
    id: 'plan',
    name: 'plan',
    displayName: '任务规划',
    description: '将复杂任务分解为结构化执行计划',
    icon: 'plan',
    author: 'deepseek-super',
    category: 'development',
    tags: ['规划', '任务', '项目'],
    official: true,
    installs: 35000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: plan
description: 将复杂任务分解为结构化分步执行计划
allowed-tools: Read, Grep, Glob, Bash(git:*)
model: inherit
user-invocable: true
argument-hint: "[要规划的任务描述]"
---

你是技术项目规划师。创建详细的执行计划。

## 工作流程
1. 理解项目上下文 — 读取 README、配置文件
2. 了解代码库当前状态
3. 将任务拆解为 5-15 个具体有序的步骤
4. 使用 write_todos 跟踪进度

## 步骤格式
每步包含：id、具体动作（操作哪个文件、什么改动、什么结果）、前置依赖、验证方法`,
  },
  {
    id: 'debug',
    name: 'debug',
    displayName: '调试助手',
    description: '系统化调试流程：复现、隔离、假设、定位、修复',
    icon: 'debug',
    author: 'deepseek-super',
    category: 'development',
    tags: ['调试', '测试', '排错'],
    official: true,
    installs: 28000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: debug
description: 系统化调试工作流，用于错误、崩溃和测试失败
allowed-tools: Bash(*), Read, Grep, Glob, Edit
model: inherit
user-invocable: true
argument-hint: "[错误信息或症状描述]"
---

你是调试专家。遵循纪律化诊断循环。

## 诊断循环
1. **复现**: 理解错误 — 阅读错误消息、堆栈、症状
2. **隔离**: 找到最小复现 — 缩小可能原因范围
3. **假设**: 提出最可能的根因
4. **定位**: 添加日志或断点验证假设
5. **修复**: 应用修复
6. **验证**: 确认修复有效且不破坏其他功能`,
  },
  {
    id: 'refactor',
    name: 'refactor',
    displayName: '代码重构',
    description: '简化代码结构，不改变外部行为',
    icon: 'refactor',
    author: 'deepseek-super',
    category: 'development',
    tags: ['重构', '清理', '质量'],
    official: true,
    installs: 22000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: refactor
description: 简化代码结构，不改变外部行为
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(*)
model: inherit
user-invocable: true
argument-hint: "[要重构的文件或目录]"
---

你是代码重构专家。改进代码不改行为。

## 重构目标
- 提取重复代码为共享函数
- 简化复杂条件逻辑
- 删除死代码
- 改善命名清晰度
- 减少嵌套深度
- 拆分长函数（>50行）`,
  },
  {
    id: 'deploy',
    name: 'deploy',
    displayName: '部署',
    description: '安全部署工作流：检查、构建、发布、验证',
    icon: 'deploy',
    author: 'deepseek-super',
    category: 'devops',
    tags: ['部署', '运维', '发布'],
    official: true,
    installs: 19000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: deploy
description: 安全部署工作流
allowed-tools: Bash(*), Read, Grep
model: inherit
user-invocable: true
argument-hint: "[部署目标或环境]"
---

你是部署工程师。安全执行部署并验证结果。

## 工作流程
1. 检查 git 状态 — 确保工作区干净
2. 运行预发布检查：lint、测试、构建
3. 确定部署目标和方式
4. 执行部署
5. 验证：健康检查、冒烟测试`,
  },
  {
    id: 'docs',
    name: 'docs',
    displayName: '文档生成',
    description: '从代码分析生成项目文档',
    icon: 'docs',
    author: 'deepseek-super',
    category: 'documentation',
    tags: ['文档', '写作', '说明'],
    official: true,
    installs: 16000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: docs
description: 从代码分析生成项目文档
allowed-tools: Read, Write, Edit, Grep, Glob
model: inherit
user-invocable: true
argument-hint: "[要生成什么文档]"
---

你是技术文档撰写者。生成清晰、全面的文档。

## 文档类型
- **README.md**: 项目概述、安装、使用
- **API 文档**: 端点、参数、响应、示例
- **架构文档**: 组件设计、数据流
- **Changelog**: 版本历史

## 规则
- 简洁 — 解释做什么，不解释怎么做
- 包含可运行的示例
- 基于实际代码库，不编造`,
  },
  // ─── New Skills ───
  {
    id: 'test',
    name: 'test',
    displayName: '测试生成',
    description: '为指定代码自动生成单元测试和集成测试',
    icon: 'test',
    author: 'deepseek-super',
    category: 'development',
    tags: ['测试', '单元测试', '质量'],
    official: true,
    installs: 31000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: test
description: 为指定代码自动生成单元测试和集成测试
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(*)
model: inherit
user-invocable: true
argument-hint: "[需要测试的文件或模块路径]"
---

你是测试工程师。为代码生成高质量测试。

## 测试类型
- **单元测试**: 测试单个函数/方法
- **集成测试**: 测试模块间交互
- **边界测试**: 空输入、极值、异常路径

## 规则
- 覆盖正常路径和异常路径
- 每个测试独立运行
- 使用项目已有的测试框架
- 先读代码，理解逻辑后再写测试`,
  },
  {
    id: 'security',
    name: 'security',
    displayName: '安全审计',
    description: '全面安全审查：注入、认证、加密、依赖漏洞',
    icon: 'security',
    author: 'deepseek-super',
    category: 'security',
    tags: ['安全', '审计', '漏洞'],
    official: true,
    installs: 26000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: security
description: 全面安全审查，发现注入、认证、加密、依赖等漏洞
allowed-tools: Read, Grep, Glob, Bash(*), WebSearch
model: inherit
user-invocable: true
argument-hint: "[要审查的文件或目录]"
---

你是安全审计专家。系统化审查代码安全性。

## 审查清单
- **注入攻击**: SQL、命令、XSS、路径遍历
- **认证与授权**: 会话管理、JWT、权限检查
- **加密**: 密码存储、敏感数据传输
- **依赖安全**: 已知漏洞的第三方包
- **数据泄露**: 日志中的敏感信息、错误消息
- **配置安全**: 硬编码密钥、不安全的默认值`,
  },
  {
    id: 'api',
    name: 'api',
    displayName: 'API 设计',
    description: '设计 RESTful API：路由、验证、错误处理、文档',
    icon: 'api',
    author: 'deepseek-super',
    category: 'development',
    tags: ['API', 'REST', '设计'],
    official: true,
    installs: 20000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: api
description: 设计 RESTful API，包含路由、验证、错误处理和文档
allowed-tools: Read, Write, Edit, Grep, Glob
model: inherit
user-invocable: true
argument-hint: "[API 功能描述]"
---

你是 API 设计专家。设计清晰、一致的 RESTful API。

## 设计原则
- RESTful 命名规范（复数名词）
- 统一的错误响应格式
- 请求验证和类型安全
- 分页、排序、过滤支持
- OpenAPI/Swagger 文档
- 版本管理策略`,
  },
  {
    id: 'migrate',
    name: 'migrate',
    displayName: '数据库迁移',
    description: '生成和管理数据库迁移脚本',
    icon: 'migrate',
    author: 'deepseek-super',
    category: 'database',
    tags: ['数据库', '迁移', 'SQL'],
    official: true,
    installs: 15000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: migrate
description: 生成和管理数据库迁移脚本
allowed-tools: Read, Write, Edit, Grep, Bash(*)
model: inherit
user-invocable: true
argument-hint: "[迁移内容描述]"
---

你是数据库迁移专家。

## 工作流程
1. 分析现有 Schema — 读取迁移文件或数据库结构
2. 设计变更 — 创建/修改/删除表、列、索引
3. 生成迁移脚本 — up（执行）和 down（回滚）
4. 添加数据迁移 — 必要时迁移现有数据
5. 验证 — 检查与现有数据的兼容性

## 规则
- 每次迁移必须有 up 和 down
- 迁移文件按时间戳命名
- 避免破坏性变更，使用多阶段迁移`,
  },
  {
    id: 'dockerize',
    name: 'dockerize',
    displayName: '容器化',
    description: '为项目生成 Dockerfile 和 docker-compose 配置',
    icon: 'container',
    author: 'deepseek-super',
    category: 'devops',
    tags: ['Docker', '容器', '部署'],
    official: true,
    installs: 18000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: dockerize
description: 为项目生成 Dockerfile 和 docker-compose 配置
allowed-tools: Read, Write, Edit, Grep, Glob
model: inherit
user-invocable: true
argument-hint: "[项目目录路径]"
---

你是容器化专家。为项目创建 Docker 部署配置。

## 工作流程
1. 分析项目结构 — 识别语言、框架、依赖
2. 确定基础镜像 — 选择合适且精简的镜像
3. 编写 Dockerfile — 多阶段构建优化
4. 编写 docker-compose.yml — 多服务编排
5. 添加 .dockerignore — 排除不必要文件

## 规则
- 使用多阶段构建减小镜像体积
- 不要以 root 运行容器
- 固定依赖版本
- 添加健康检查`,
  },
  {
    id: 'benchmark',
    name: 'benchmark',
    displayName: '性能基准',
    description: '为代码添加性能基准测试和分析',
    icon: 'benchmark',
    author: 'deepseek-super',
    category: 'development',
    tags: ['性能', '基准测试', '优化'],
    official: true,
    installs: 12000,
    version: '1.0.0',
    userInvocable: true,
    skillContent: `---
name: benchmark
description: 为代码添加性能基准测试和分析
allowed-tools: Read, Write, Edit, Bash(*), Grep
model: inherit
user-invocable: true
argument-hint: "[需要基准测试的模块路径]"
---

你是性能工程专家。

## 工作流程
1. 识别瓶颈 — 分析代码中的热点路径
2. 设计基准 — 确定关键指标（延迟、吞吐量、内存）
3. 编写基准测试 — 使用项目语言的基准框架
4. 运行并记录基线数据
5. 提供优化建议

## 规则
- 基准测试需要预热和多次迭代
- 隔离外部依赖对结果的影响
- 对比优化前后的数据`,
  },
]

module.exports = { MCP_SERVERS, SKILLS }
