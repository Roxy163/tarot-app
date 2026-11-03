# 牌面离线可用修复 · 2026-11-03

状态：2026-11-03 已同步发布到 Cloudflare Pages 和 Netlify，应用提交 `008838d`、响应头修正 `cec789e` 已推送 `main`。最终构建与 PWA 版本 **`e280c97b99e7`**，包含此前五项复盘、第二轮七项便利性、牌面离线及上线前补验。下方 `016a38441e2c`／775 项为发布前阶段；最终线上结果见文末“双站发布记录”。

Service Worker 离线验收使用生产构建预览 `http://localhost:3004/`；开发预览 `http://localhost:3003/` 保留，不用开发服务器证明离线缓存生效。

## 用户问题与修复范围

用户断网后，首页日运出现“牌面暂不可用”，并要求其他使用牌面的地方一起处理。原来牌面主要依赖访问时的运行时缓存；未访问的牌或浏览器选中的另一种格式不一定在缓存内。图片失败后也没有同源格式回退与恢复连接后的重试。

本轮统一修复牌面资源、Service Worker、中央图片组件和预加载，不逐页另造图片逻辑。全部牌面入口均通过 `TarotCardImage + getCardImageUrl`：

| 区域 | 覆盖内容 |
| --- | --- |
| 首页与日运 | 日运两种展示、档案、补写、牌库中的历史与例证 |
| 典籍与公开手记 | 手记缩略图、原牌阵、逐牌解读、按牌索引、广场牌例与示范 |
| 牌义库 | 牌库网格／列表、牌义资料、注疏编辑 |
| 录入与选择 | 选牌器、各牌阵位置、当前牌的大图、复盘选中牌与放大预览 |
| 牌义小考 | 题面和图片选项 |

牌阵工作台原本只显示序号和位置标签，没有额外图片请求；其视觉、布局和保存坐标保持不变。远程用户头像加载失败时回到现有用户图标，不把私人头像纳入公共牌面缓存。App 图标继续使用离线壳缓存。

## 最终行为

1. **整套牌面离线缓存**：78 张牌的 AVIF／WebP／JPEG 共 **234 个同源资源**随生产构建列入离线清单。需要先联网完成一次资源缓存；之后断网使用不要求逐张提前打开。首次缓存尚未完成或浏览器主动清理站点数据时，需要重新联网完成缓存。
2. **缓存完整性**：构建校验 78 个唯一牌面 ID 及三格式文件，并将 Worker 策略和图片内容纳入版本哈希。安装以受控并发下载；三格式牌面没有全部成功时，新 Worker 不取代可用旧版本，并清理本次不完整缓存。
3. **可靠读取**：牌面使用缓存优先。只接受同源、路径正确、未重定向且与扩展名匹配的图片 MIME；缺图时返回的 HTML 不能被当成牌面缓存。请求是否带查询参数不影响查找同一已缓存牌面。
4. **格式回退与重试**：浏览器选中的 AVIF 加载失败后继续尝试 WebP、JPEG；全部失败才保留带牌名的占位。恢复联网或首次 Worker 接管触发 `controllerchange` 时，同一牌面可重试，不停留在旧失败状态；保留原图片尺寸、正逆位及点选范围。
5. **预加载可补热**：只有加载或解码成功才记为成功；图片错误、解码拒绝／异常和超时会清除 pending、计时器及隐藏图片，后续可重试。联网监听只注册一次，重复事件合并为有界补热，跳过已成功图片；保留省流、慢网的目标预算和并发限制。
6. **首装与升级保护**：是否首次安装的决定保存在该版本缓存内，Worker 在 install 与 activate 之间重启也不会丢失判断。只有明确首次安装才接管当前页面，使已打开页面也能用离线缓存；缺少标记不能被解释成首装。升级保持等待旧页面关闭的行为，不自动 `skipWaiting`，不让仍使用旧哈希模块的页面被新 Worker 强行接管。

## 发布前本地验收

- 本地离线阶段 **98 个测试文件／775 项测试**、`npm run lint`、`npm run build` 全部通过。构建日志确认 **15 个应用资源＋234 个牌面资源**，阶段版本 `016a38441e2c`；最终上线版本及 777 项结果见文末。
- 日志：`/tmp/tarot-final-offline-all.log`、`/tmp/tarot-final-offline-lint.log`、`/tmp/tarot-final-offline-build.log`。
- 浏览器先完成该版本安装，随后清除普通 HTTP 缓存、将浏览器上下文设置为断网，并用未缓存的 fetch 请求确实失败作探针；在该状态下 **234 个图片资源全部解码成功**。因此结果不依赖普通 HTTP 缓存命中或仅修改 `navigator.onLine`。
- 首页“宝剑三”在上述断网状态正常显示，截图 `output/playwright/offline-home-390.png`。
- 逐页真实断网实测通过：在选牌器选择此前未打开的“星币国王”，录入槽位、复盘原牌阵、放大“隐士”及“星币国王”牌义资料均显示真实图片。截图：`output/playwright/offline-picker-390.png`、`offline-zoom-390.png`、`offline-metadata-390.png`。
- 格式故障注入通过：在隔离测试缓存中删除“宝剑三”的 AVIF／WebP、清除 HTTP 缓存并断网重载，实际 `currentSrc` 回退到 `sw03.jpg`，`naturalWidth` 为 330；补回两份缓存并触发恢复联网事件后，同一张牌自动重试为 AVIF。测试最终已恢复完整 234 个缓存资源，未改真实用户资料。
- 同一真实断网状态下，**9 个官方牌阵 × 320×568／390×844／844×390／1280×800 × 录入／复盘，共 72 场景全部通过**，检查完整牌布可见、高度不超过 380px、全部触控区域至少 44px。几何基准未改。
- 牌阵截图：`output/playwright/offline-geometry-original-{320,390,844,1280}.png`、`offline-geometry-celtic-{320,390,844,1280}.png`、`offline-geometry-yearly-{320,390,844,1280}.png`。

本轮未改用户记录、已保存手记、牌阵坐标、公开权限或 Firebase Rules。此前七项便利性修复的最终行为与导航实测见 `docs/usability-audit-round2-2026-11-03.md`。

## 双站发布记录

### 版本与地址

- 应用提交 **`008838d`**、响应头修正 **`cec789e`** 已推送 `main`。同一份静态构建发布到两个既有站点，未新建网站或改变主网址；最终 PWA 版本 **`e280c97b99e7`**。
- Cloudflare [正式地址](https://tarot-pavilion.pages.dev/)／[最终固定部署地址](https://4cabddf4.tarot-pavilion.pages.dev/)。
- Netlify [正式地址](https://tarot-pavilion.netlify.app/)／[最终固定部署地址](https://6ae9fbc42f212da2747a0561--tarot-pavilion.netlify.app/)，沿用站点 ID `281250b7-fdfb-40b3-8981-e2c207880f0f`。
- 最终 **98 个测试文件／777 项测试**、类型检查、生产构建及 Functions 编译全部通过。日志：`/tmp/tarot-release-20261103-tests.log`、`/tmp/tarot-release-20261103-lint.log`、`/tmp/tarot-release-20261103-build.log`、`/tmp/tarot-release-20261103-functions.log`。

### 上线前补足

- 日运删除保护覆盖不同旧 ID 的同日副本：只要旧副本创建于删除之前，即使旧设备在删除之后才更新、`updatedAt` 更晚，也不会复活旧日运或覆盖保留例证。删除之后真正重新抽取、具有新 ID 和较晚创建时间的日运仍正常保留；新增两项回归后全量由 775 项增至 777 项。
- Netlify 初次发布的 `/site.webmanifest` MIME 为 `application/octet-stream`。`public/_headers` 现显式设置 `application/manifest+json`；修正后两站重新发布并核对。该响应头修正不改变静态资源内容与 PWA 版本。

### 线上资源与真实断网验收

- 两个正式主域各 **255 项**，两个最终固定部署地址各 **24 项**，共 **558 项资源核验全部通过**。非 HTML 内容 SHA-256 与本机期望一致；HTML 均返回 200 并包含完整本地入口 URL，Netlify 平台注释不要求逐字节一致。
- SW 均为 `e280c97b99e7`；SW／manifest 的 `no-cache`、全站 `nosniff`、JS／CSS 与牌面长期缓存头均正确，三种牌面格式的 MIME 正确。两站 manifest 现均为 `application/manifest+json`。
- 资源核验：`/tmp/tarot-release-20261103-fixed-resources.json`（最终固定地址 48 项）、`/tmp/tarot-release-20261103-expected.json`（本机 255 项期望）；主域浏览器日志为 `/tmp/tarot-release-20261103-cf-browser.log`、`/tmp/tarot-release-20261103-nl-browser.log`。
- 两站在独立新浏览器首次安装后，各自 **234 个牌面资源缓存完整**。随后清除 HTTP 缓存并将浏览器上下文断网，用未缓存 fetch 请求失败作探针；首页“宝剑三”均显示真实图片，图片自然宽度 **330px**。
- 同一真实断网条件下，两站各 **9 个官方牌阵 × 4 个视口 × 录入／复盘＝72 场景**，合计 **144 场景全部通过**：完整牌布在视口内、高度不超过 380px、全部触控区域至少 44px。几何基准与保存坐标未改。
- 线上截图：`output/playwright/release-{cloudflare,netlify}-offline-home-390.png`、`release-{cloudflare,netlify}-geometry-{celtic,yearly,original}-{320,390,844,1280}.png`。牌阵日志：`/tmp/tarot-release-20261103-cf-geometry.log`、`/tmp/tarot-release-20261103-nl-geometry.log`。
- 两站未捕获页面 `pageerror`。断网探针、离线 analytics 请求出现预期网络日志；Cloudflare 首次 analytics 安装请求曾返回 503，未影响页面或离线资源安装。

### 边界

- Cloudflare 反馈接口对空 POST 返回预期 **400**；Netlify 兼容入口返回 **307** 并指向同一 Cloudflare 服务。另在 Netlify 主域浏览器实际请求空 JSON，跟随重定向后最终状态 **400**，`response.url` 为 `https://tarot-pavilion.pages.dev/api/feedback`，返回要求补充内容的拒绝 JSON。实际跟随链路核验通过，未发送邮件；日志 `/tmp/tarot-release-20261103-api.log`、`/tmp/tarot-release-20261103-feedback-browser.log`。
- 未发送真实邮件、登录或修改真实用户账号。Firestore Rules、公开权限及正式用户资料未改，不重新发布规则。
