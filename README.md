# SuperDS

全功能 AI 聊天 & 编程助手，图片 OCR 文字识别。基于 Electron + Vue 3 + Express。

## 环境要求

- **Node.js** ≥ 18
- Windows / Linux / macOS

## 开发

```bash
# 安装依赖
npm install

# 配置 API Key
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 前端热更新开发
npm run dev     # → http://localhost:5173

# 后端单独启动
npm run server  # → http://localhost:3001

# Electron 桌面应用
npm run electron
```

## 打包分发

```bash
# 打包为安装程序 (输出到 release/)
npm run dist

# 或打包为便携版（绿色免安装）
npm run dist:portable
```

打包完成 → `release\SuperDS Setup x.x.x.exe` → 上传 GitHub Releases

用户下载 → 安装 → 桌面快捷方式 → 双击启动。

## 功能

- **Chat 模式**：多轮对话，支持粘贴/上传图片，自动 OCR 提取文字
- **Code 模式**：项目级代码编辑，同样支持图片 OCR
- OCR 引擎：Tesseract.js（浏览器端，支持中英文）

## 项目结构

```
├── electron/
│   ├── main.cjs        # Electron 主进程
│   └── preload.cjs     # 预加载脚本
├── src/                # Vue 3 前端
│   ├── pages/          # ChatView / CodeView
│   ├── utils/ocr.js    # OCR (Tesseract.js)
│   └── ...
├── server/             # Express 后端 API
│   ├── index.js        # 服务入口
│   └── ...
└── package.json
```

## 许可证

MIT
