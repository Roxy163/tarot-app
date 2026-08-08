# 塔罗研习阁 (Tarot Pavilion) 开发守则

本文件记录了项目的核心设计哲学、关键逻辑以及需要永久保护的交互细节，以防止在代码重构或功能迭代中丢失。

## 1. 核心设计哲学
- **禅意与森林感 (Forest Theme)**：UI 必须坚持 `forest-` 前缀的 Tailwind 调色体系（如 `forest-accent`, `forest-bg`, `forest-ink`）。
- **动感反馈 (Motion First)**：使用 `motion/react` 处理所有路由切换、弹窗弹出和卡牌交互。保持 staggered (交错) 入场效果。
- **排版一致性**：标题使用 `font-serif` 和 `font-bold`，正文使用 `font-sans`。

## 2. 需要保护的关键逻辑
- **抽牌手记 (AddReadingForm)**:
    - **逻辑同步**：`cardSlots` 必须与 `spreads` 定义严格同步。切换牌阵时必须自动映射 labels 和 positions。
    - **历史记录 (Undo)**：必须保留 `history` 状态管理，确保用户可以撤销错误的组件重排。
    - **长按删除 (Long Press)**：卡牌槽位的长按清空逻辑（600ms 定时器 + 震动反馈）是核心体验，不可简化。
    - **正逆切换**：支持点击大图预览、点击状态标签以及点击槽位快捷按钮三种切换方式。
    - **官方牌阵与编辑器保护**：`OFFICIAL_SPREADS` 与 `SpreadDesigner` 的交互是核心，重构时必须确保：
        1. 布局模板 (LAYOUT_TEMPLATES) 的映射关系不可断裂。
        2. 自定义布局 (Custom Layout) 时的坐标保存 (slotPositions) 必须精准。
        3. 官方牌阵的“恢复默认”逻辑必须保留。

## 3. 功能独立化 (Refactoring) 准则
- **原子化拆分**：在将 `AddReadingForm.tsx` 等大型文件拆分时，必须优先确保 `props` 完整透传。
- **类型先行**：所有涉及跨组件传输的复杂对象（如 `SpreadDefinition`, `TarotCardMetadata`）必须定义在 `src/types.ts`。
- **状态提升**：如果重构导致功能失效，优先检查 `activeSlotIndex` 和全局 `session` 状态的流转。

## 4. 特殊交互规范
- **禁止使用 `window.alert`**：所有通知必须使用项目中已有的 `Snackbar` 或自定义 Modal。
- **移动端适配**：所有可点击的按钮（TabButton, Slot）必须保证在移动端有足够的触控面积（最小 44px）。

## 5. Skill 使用偏好
- **默认 Skill 目录**：需要额外能力时，优先查看并使用 `/Users/roxy/AI-blah/skills` 中已安装的 skill。
- **省 token 工作流**：长任务、连续优化、多文件排查时，优先使用 `ultra-compact-reasoning`，保持简短进度与高频验证，不因省 token 跳过必要测试、预览或保护。
- **页面交互检查**：涉及浏览器页面、移动端、自由画布、表单流程、牌阵展示或部署前验收时，优先使用 `playwright`，并在需要时给出预览地址。
- **长日志命令**：运行全量测试、build、长时间命令或日志很多的任务时，优先使用 `log-pulse` 或等价方式减少无意义日志输出，只保留关键结果与失败摘要。
- **Netlify 部署**：预览部署、正式部署、Netlify 链接状态检查时，优先使用 `netlify-deploy`。
- **安全检查**：涉及登录、云端同步、公开分享、用户数据或上线前检查时，优先使用 `security-best-practices`。
- **目标澄清**：任务范围大、目标模糊或需要验收标准时，可先使用 `define-goal` 明确目标、范围与完成证据。

## 6. Firebase 部署记忆
- Firebase Project ID 固定为 `tarot-pavilion`，根目录 `.firebaserc` 已设置 default project。
- 只部署 Firestore Rules 使用：`npx --yes firebase-tools deploy --only firestore:rules --project tarot-pavilion`。
- 如果 Firebase CLI 登录出现 `credentials are no longer valid` 或网页 `Firebase CLI Login Failed`，不要反复让用户复制 authorization code。最多尝试一次 `firebase login --reauth`；仍失败时，改走服务账号 / ADC，或让用户在 Firebase Console 手动发布 `firestore.rules`。
- 详细复盘和稳定方案见 `docs/firebase-deployment-runbook.md`。

## 7. 新窗口接续记忆
- 新的 Codex 对话窗口处理本项目时，无需用户记住或重复说明路径；只要当前工作目录是本项目，就必须先读本文件和 `docs/tarot-app-project-memory.md`，再开始改代码。该记忆文件记录了长期产品调性、核心功能、部署方式和用户协作偏好。
