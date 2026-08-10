# 塔罗研习阁埋点说明

这套埋点分两层：

- Cloudflare Web Analytics：看访问量、访问地区、设备、页面性能等站点数据。
- Firebase Analytics：看日运、小考、导出、登录等 App 内功能使用。

两层都只用于产品复盘，不采集用户写下的隐私内容。

## 去哪里看

- Cloudflare Dashboard → Web Analytics：看有多少人访问、来自哪里、手机/电脑占比、页面性能。
- Firebase Console → Analytics → Realtime：看当前是否有人在用、刚触发了哪些事件。
- Firebase Console → Analytics → Events：看各功能事件量，例如日运、小考、导出。
- Google Analytics → Retention / Engagement：看是否持续使用。首次接入后通常需要等一段时间才有完整报表。

## Cloudflare Web Analytics 接入

如果 Cloudflare Pages 后台已经开启自动注入，不需要配置代码里的 token。

如果希望由应用代码主动加载 Cloudflare 统计脚本，在 Cloudflare Web Analytics 里复制站点 token，然后在部署环境变量里设置：

```env
VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN=your-cloudflare-web-analytics-token
```

本地或预览环境不想统计时，保持 token 为空即可。也可以统一设置：

```env
VITE_ANALYTICS_DISABLED=true
```

## 已埋核心事件

| 事件 | 说明 |
| --- | --- |
| `app_open` | 用户进入应用主界面 |
| `splash_enter` | 用户从启动页进入研习台 |
| `tab_opened` | 切换到研习台、记录、典籍、广场等 |
| `login_success` / `logout` | 登录状态变化 |
| `pwa_install_requested` | 用户点击“添加到手机桌面”入口 |
| `pwa_install_result` | 添加桌面结果：接受、取消、失败或当前浏览器不可用 |
| `daily_deck_shuffled` | 日运洗牌 |
| `daily_fortune_saved` | 保存今日日运 |
| `daily_reflection_saved` | 保存第一直觉 / 今日回看 |
| `daily_fortune_archived` | 归档到日运复盘 |
| `daily_annotation_saved` | 日运归入牌义注疏 |
| `daily_review_exported` | 导出日运复盘 |
| `reading_saved` | 保存抽牌手记 |
| `reading_ai_processed` | AI 整理/处理手记 |
| `archive_exported` | 典籍导出 |
| `card_library_exported` | 牌义库导出 |
| `quiz_answered` | 牌义小考作答 |
| `quiz_question_refreshed` | 小考换题 |
| `quiz_archive_opened` | 打开小考档案 |
| `quiz_keywords_saved` | 从小考补关键词 |

## 隐私边界

埋点代码不会设置 Firebase 用户 ID，也会自动过滤这些字段名：邮箱、手机号、姓名、客户、问题正文、提示词、解读正文、复盘正文、笔记、密码、token、关键词、标签、用户 ID 等。

新增埋点时只传粗粒度信息，例如：

- `format`: `pdf` / `csv` / `markdown`
- `record_count`: 导出记录数
- `card_count`: 一条手记有几张牌
- `tab`: 当前页面
- `quiz_kind`: 小考题型

不要传这些：

- 占卜问题原文
- 每张牌的解读正文
- 用户复盘正文
- 客户姓名
- AI 提示词
- 用户自定义标签或关键词原文
