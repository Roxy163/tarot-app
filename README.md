# 塔罗研习阁 (Tarot Pavilion)

> 开启你的塔罗智慧之旅

一个现代化的塔罗占卜应用，提供沉浸式的占卜体验、牌义注疏管理和云端同步功能。

## ✨ 核心功能

### 🔮 占卜系统
- **多种牌阵**：支持圣三角、六芒星等经典牌阵
- **智能解读**：AI 深度解析牌面组合
- **抽牌手记**：支持自定义牌阵设计

### 📚 牌义注疏
- **完整牌库**：78张韦特塔罗牌全收录
- **个人牌义**：自定义每张牌的解读
- **灵数计算**：生命灵数与塔罗的深度结合

### ☁️ 云端同步
- **数据备份**：占卜记录自动云端保存
- **跨设备同步**：多设备数据无缝同步
- **隐私保护**：端到端加密存储

### 🏆 研习系统
- **等级晋升**：从学徒到塔罗大师
- **成就徽章**：解锁专属成就
- **学习进度**：跟踪你的研习之旅

## 🛠️ 技术架构

```
┌──────────────────────────────────────────────────────────────┐
│                    前端 (React + TypeScript)                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  UI 组件    │ │  状态管理    │ │    路由导航         │   │
│  │  (Tailwind) │ │  (Context)  │ │  (React Router)     │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    数据层 (Firebase)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Authentication│ │   Firestore │ │    Storage         │   │
│  │  (用户认证)   │ │  (数据库)   │ │  (文件存储)        │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 本地运行

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**

创建 `.env` 文件，填入你的 Firebase 配置：

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

3. **启动开发服务器**
```bash
npm run dev
```

4. **构建生产版本**
```bash
npm run build
```

## 🗂️ 项目结构

```
src/
├── components/          # UI 组件
│   ├── Auth.tsx        # 认证组件
│   ├── ReadingCard.tsx  # 占卜记录卡片
│   ├── AddReadingForm.tsx # 抽牌表单
│   └── ...
├── context/            # 全局状态管理
│   └── AuthContext.tsx  # 认证上下文
├── lib/                # 工具函数与配置
│   ├── firebase.ts      # Firebase 初始化
│   └── firebaseData.ts  # 数据层 API
├── pages/              # 页面组件
│   ├── StudyPage.tsx    # 研习台
│   ├── DiaryPage.tsx    # 手记
│   ├── ArchivePage.tsx  # 典籍
│   └── ...
├── constants.ts         # 常量定义
├── types.ts            # TypeScript 类型定义
└── App.tsx             # 主应用入口
```

## 🔧 Firebase 配置

### 必要配置

1. **Authentication**
   - 启用 Email/Password 登录方式
   - 添加授权域名

2. **Firestore Database**
   - 创建数据库实例
   - 部署 `firestore.rules`

3. **Storage**（可选）
   - 启用 Cloud Storage
   - 部署 `storage.rules`

### 安全规则部署

```bash
# 部署 Firestore 规则
firebase deploy --only firestore:rules

# 部署 Storage 规则
firebase deploy --only storage:rules
```

## 📋 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run lint` | 运行 TypeScript 检查 |
| `npm run preview` | 预览生产构建 |

## 📝 开发指南

### 代码规范
- 使用 TypeScript 进行类型检查
- 组件使用 PascalCase 命名
- 函数使用 camelCase 命名
- 遵循 ESLint 规则

### 样式规范
- 使用 Tailwind CSS 进行样式开发
- 使用 `forest-` 前缀的主题色
- 标题使用 `font-serif`，正文使用 `font-sans`

## 📄 许可证

MIT License

---

**开启你的塔罗智慧之旅 ✨**

[塔罗研习阁](https://tarot-pavilion.com)