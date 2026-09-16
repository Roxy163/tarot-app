# Firebase 部署记录与故障处理

本文记录“塔罗研习阁”部署 Firebase Firestore Rules 时踩过的坑，避免后续反复走低效授权流程。

## 项目信息

- Firebase Project ID：`tarot-pavilion`
- Firestore rules 文件：`firestore.rules`
- Firebase CLI 配置：`firebase.json`
- 只部署 Firestore Rules：

```bash
npx --yes firebase-tools deploy --only firestore:rules --project tarot-pavilion
```

## 2026-07-18 登录故障复盘

现象：

- `firebase deploy --only firestore:rules --project tarot-pavilion` 报错：

```text
Error: Failed to authenticate, have you run firebase login?
```

- 多次执行 `firebase login --no-localhost` 后，网页返回：

```text
Firebase CLI Login Failed
The Firebase CLI login request was rejected or an error occurred.
```

- CLI 也返回：

```text
Authentication Error: Your credentials are no longer valid. Please run firebase login --reauth
Error: Unable to authenticate using the provided code. Please try again.
```

判断：

- 不是 Firestore rules 语法问题。
- 不是前端代码问题。
- 是 Firebase CLI 本机登录凭据 / OAuth 授权链路失效。
- `--no-localhost` 的授权码是一次性、短时效、强绑定当前 session 的；如果网页停留过久、复制了旧页面的码、浏览器账号切换或旧凭据损坏，就会失败。
- 已确认服务账号 JSON 文件本身有效：
  - `type` 为 `service_account`
  - `project_id` 为 `tarot-pavilion`
  - `client_email` 为 `tarot-pavilion-deployer@tarot-pavilion.iam.gserviceaccount.com`
- 但当前终端环境直连 Google OAuth 失败：

```text
TOKEN_FETCH_FAILED fetch failed
CAUSE UND_ERR_CONNECT_TIMEOUT Connect Timeout Error
```

结论：如果出现上述超时，继续尝试 `firebase login` / authorization code / 服务账号部署都会浪费时间；先解决终端访问 `oauth2.googleapis.com:443` 的网络/代理问题，或临时走 Firebase Console 手动发布 Rules。

## 以后不要反复尝试的流程

如果出现同样错误，最多尝试 1 次：

```bash
npx --yes firebase-tools login --reauth
```

如果浏览器回调或授权码仍失败，不要继续反复索要验证码。直接改用下面的长期方案。

如果服务账号方案也卡住，先测试终端是否能访问 Google OAuth。若出现 `UND_ERR_CONNECT_TIMEOUT`，直接停止 CLI 尝试。

## 推荐的一劳永逸方案：服务账号 / ADC

Firebase 官方推荐在 CI 或非交互环境中使用 Application Default Credentials（ADC）/ 服务账号，而不是长期依赖 `login:ci` token。

推荐做法：

1. 打开 Google Cloud Console / Firebase 所属项目。
2. 进入 IAM & Admin → Service Accounts。
3. 创建一个专门用于部署规则的服务账号，例如：
   - `tarot-pavilion-deployer`
4. 授予它部署 Firestore Rules 所需权限。
   - 优先使用最小权限：Firebase Rules Admin / Project Viewer。
   - 如果 CLI 提示权限不足，再临时补充需要的 Firebase/Firestore 管理权限，部署成功后再收紧。
5. 创建 JSON key。
6. 把 JSON key 放在仓库外，例如：

```text
~/.config/tarot-pavilion/firebase-deployer.json
```

7. 用下面命令部署：

```bash
GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/tarot-pavilion/firebase-deployer.json" \
  npx --yes firebase-tools deploy --only firestore:rules --project tarot-pavilion
```

注意：

- 服务账号 JSON 是敏感凭据，绝对不要提交到 Git。
- 不要放进项目目录，避免误传。
- 如果服务账号泄露，立刻在 Google Cloud Console 删除对应 key。

## 临时方案：控制台手动发布 Rules

如果当下只是急着修复云端权限，可以不用 CLI：

1. 打开 Firebase Console。
2. 进入 Firestore Database → Rules。
3. 把本项目的 `firestore.rules` 内容复制进去。
4. 点击 Publish。

注意：

- 手动发布后，仍要保持仓库里的 `firestore.rules` 是最新版本。
- 后续再用 CLI 部署时，CLI 会用仓库文件覆盖控制台当前内容。

## CLI 授权卡住时的代理与 REST 备选

- 先确认本机代理端口能访问 `https://oauth2.googleapis.com/token`。2026-09-16 直接连接超时，但经本机代理可连接。
- `NODE_USE_ENV_PROXY=1` 能让 Node 的 `fetch` 走 `HTTP_PROXY` / `HTTPS_PROXY`；但 Firebase CLI 使用自己的授权链路，仍可能停在取令牌。不要仅因 Node 连通就反复重试 CLI。
- 可用仓库外服务账号向 Google OAuth 换取短期令牌，再按 [Firebase Rules REST API](https://firebase.google.com/docs/rules/manage-deploy#use_the_rest_api) 执行：先读取线上 `cloud.firestore` release 和规则源码，与上一个 Git 版本比对；无意外差异才创建 ruleset、用 `updateMask=rulesetName` 更新 release，并回读确认内容一致。
- 不要打印令牌或私钥，不要把服务账号文件写进仓库。规则发布后可能需要数分钟传播；在确认前不要做真实账号注销测试。

## 当前需要的 Rules 能力

截至 2026-07-18，前端会用到这些用户私有数据：

- `users/{uid}/readings`
- `users/{uid}/settings/spreads`
- `users/{uid}/settings/cardMetadata`
- `users/{uid}/settings/cardKeywordMemory`
- `users/{uid}/settings/quizMemory`
- `users/{uid}/settings/dailyFortunes`
- `users/{uid}/settingsBackups/{settingId}`
- `users/{uid}/cardAnnotations/{cardName}`
- `users/{uid}/numerologySettings/{cardName}`
- `profiles/{uid}`
- `publicReadings/{readingId}`

如果线上出现“保存云端失败”，先确认线上 Firestore Rules 是否包含上述 settings 白名单，尤其是：

- `quizMemory`
- `dailyFortunes`
- `settingsBackups`

## 部署成功后记录

每次 Firestore Rules 成功部署后，在这里追加一行：

```text
YYYY-MM-DD：使用 <登录方式> 部署 firestore.rules 到 tarot-pavilion，结果：成功/失败，备注：...
```

```text
2026-07-18：使用 Firebase Console 手动发布 firestore.rules 到 tarot-pavilion，结果：成功，备注：终端访问 oauth2.googleapis.com 超时，CLI/服务账号部署暂不可用；控制台粘贴前需确认第一行为 rules_version = '2';。
2026-09-16：使用仓库外服务账号，经本机代理调用 Firebase Rules REST API 发布 firestore.rules 到 tarot-pavilion，结果：成功。发布前线上规则与上一版 Git 文件一致；发布后回读 cloud.firestore release 与规则源码，SHA-256 前 12 位为 62b88a74045b。Firebase CLI 在获取授权令牌时仍会卡住，不能仅凭 Node 网络连通就认定 CLI 可用。
```

## 参考

- Firebase CLI 官方文档：`firebase login` 默认使用 localhost 回调；远程环境才使用 `--no-localhost`。
- Firebase CLI 官方文档：CI / 无头环境推荐使用 Application Default Credentials；`FIREBASE_TOKEN` 属于 legacy，不再推荐作为长期方案。
