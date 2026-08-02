# 全量自动测试与代码核查报告

日期：2026-08-02

## 使用的 Skills 与 MCP

本轮自动筛选后使用：

- `code-review-and-quality`：用于代码质量、权限、架构、上线风险核查。
- `verification-before-completion`：用于所有“通过/完成”结论前的命令验证。
- `semgrep`：从 GitHub 开源 skill 安装，用于静态安全和代码质量扫描。
- `multi_agent_v1` MCP：并行启动两个只读核查 agent。
  - 后端/部署风险核查。
  - 前端/UI/测试覆盖核查。

本轮追加扫描：

- `uvx semgrep --config p/default --config p/secrets --config p/python --config p/typescript backend/app src`：通过，0 findings。

未使用：

- WeChat MCP：与代码测试无关。
- `node_repl`：本轮没有需要浏览器或 JS 内核辅助的交互测试。
- 额外 MCP 插件：本轮没有安装新的 MCP 插件；代码核查使用的是从 GitHub 安装的 Semgrep skill 和 CLI。

## 自动测试结果

### 前端

| 命令 | 结果 |
| --- | --- |
| `npm ci` | 通过；仍提示 11 个 moderate audit 项 |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm test -- --runInBand` | 通过，84 个 suites / 367 个 tests |
| `npx expo export --platform ios` | 通过，输出 `dist` |
| `npm audit --audit-level=moderate` | 失败，仍有 11 个 moderate，修复涉及 Expo 版本链破坏性升级 |

### 后端

| 命令 | 结果 |
| --- | --- |
| `cd backend && uv sync --frozen` | 通过 |
| `cd backend && uv run ruff check .` | 通过 |
| `cd backend && uv run ty check` | 通过 |
| `cd backend && BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest -q` | 通过，479 个 tests |
| `cd backend && docker compose config` | 通过 |
| `cd backend && docker compose build api` | 通过 |
| OpenAPI 重新生成并与 `backend/openapi.json` 字节比较 | 通过 |

### 服务器 Demo

| 检查 | 结果 |
| --- | --- |
| `http://120.26.28.208/health/ready` | 通过 |
| `http://120.26.28.208/api/v1/home` | 通过 |
| `http://120.26.28.208/api/v1` | 301 到 `/api/v1/` |
| `http://120.26.28.208/api/v1/` | 307 回 `/api/v1`，存在 API root 重定向循环 |

说明：具体 API 路径可用；API root 存在 Nginx/FastAPI 尾斜杠循环，需要修复。

### Simulator / 端到端 UI

- 当前检测到 iOS Simulator 已启动：`iPhone 17 Pro`。
- 本机未检测到 `maestro` 或 `detox` 命令。
- 因此本轮没有执行可重复的真机/模拟器点击式 E2E，只完成 Jest UI 测试、Expo iOS export 和远端 API smoke。

## 本轮追加修复

- 社区文本校验：标题、正文、评论 trim 后为空会返回 422。
- 社区父评论保护：隐藏或拒绝的父评论不可继续被回复。
- 社区举报保护：同一用户同一目标只允许一个 open 举报，新增数据库 partial unique index 和目标一致性 CHECK。
- 账号注销：补充清理用户提交过的举报和相关审核日志。
- AI 配额性能：`_attempts_in_window` 改为数据库侧 `count()`，Semgrep finding 已清零。
- 前端真实性：每日酒单“查看全部”可跳转；个人页分享接系统 Share；社区关注流按关注作者过滤；附近酒吧未接定位前显示暂未开放。

### P0：上线/公网 Demo 高风险

1. **ECS Demo 仍使用明文 HTTP**
   - 位置：
     - [docs/ecs-deployment-runbook.md](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/docs/ecs-deployment-runbook.md:98)
     - [docs/ecs-deployment-status-2026-08-02.md](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/docs/ecs-deployment-status-2026-08-02.md:10)
   - 影响：Bearer token、验证码登录流、AI 聊天内容、社区内容都可能被窃听。
   - 下一步：配置正式域名、HTTPS 证书；前端 preview/production API 改成 HTTPS。

2. **短信 IP 限流在 Nginx 反代后可能失真**
   - 位置：
     - [backend/app/api/routes/auth.py](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/backend/app/api/routes/auth.py:53)
     - [deploy/ecs/nginx/beiyu-api.conf](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/deploy/ecs/nginx/beiyu-api.conf:19)
   - 影响：后端使用 `request.client.host`，ECS 上可能只看到 `127.0.0.1`，短信风控失效或全站共用额度。
   - 下一步：增加可信代理 IP 解析，只信任本机 Nginx 的 `X-Forwarded-For`。

3. **生产占位密钥仍需人工替换和服务器轮换**
   - 位置：
     - [deploy/ecs/server.env.example](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/deploy/ecs/server.env.example:15)
     - [deploy/ecs/server.env.example](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/deploy/ecs/server.env.example:23)
     - [backend/app/core/config.py](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/backend/app/core/config.py:165)
   - 影响：本地和服务器环境变量一旦外泄，需要轮换；`docker compose config` 会打印实际环境变量。
   - 下一步：不要外传 compose 原始输出；上线前轮换 JWT secret、AI key、memory HMAC key。

4. **EAS 生产配置仍是骨架**
   - 位置：
     - [eas.json](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/eas.json:30)
     - [eas.json](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/eas.json:37)
     - [app.json](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/app.json:15)
   - 影响：production API 是 `api.beiyu.example.com`，App Store Connect ID 是 `REPLACE_WITH...`，Android 缺 package，不能正式发布。
   - 下一步：补真实 API 域名、ASC ID、Android package，并新增测试禁止 `example.com` 和 `REPLACE_WITH`。

5. **社区/头像图片上传没有真实媒体闭环**
   - 位置：
     - [src/services/postImagePickerService.ts](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/services/postImagePickerService.ts:38)
     - [src/state/MixologyState.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/state/MixologyState.tsx:572)
     - [src/app/edit-profile.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/app/edit-profile.tsx:385)
   - 影响：本地 `file://` 图片跨设备、重装、后端展示都会失效。
   - 下一步：实现媒体上传 API、预签名 URL、CDN URL 入库、图片审核和失败回滚。

6. **账号安全、实名、注销仍有本地轻实现**
   - 位置：
     - [src/app/account-security.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/app/account-security.tsx:25)
     - [src/state/MixologyState.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/state/MixologyState.tsx:728)
     - [src/state/MixologyState.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/state/MixologyState.tsx:770)
     - [src/app/realname-verify.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/app/realname-verify.tsx:29)
   - 影响：手机号变更、实名核验、注销不能按生产能力对外承诺。
   - 下一步：未接后端前继续禁用或改文案；注销、手机号变更、实名接真实后端 API。

### P1：需要尽快修复

1. **容器启动自动执行 Alembic 迁移，扩容/回滚风险较大**
   - 位置：
     - [backend/Dockerfile](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/backend/Dockerfile:39)
     - [backend/scripts/prestart.sh](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/backend/scripts/prestart.sh:4)
   - 影响：多容器部署会有迁移竞态；回滚时可能旧代码跑在新 schema。
   - 下一步：迁移改为一次性 release job，应用容器只启动服务。

2. **社区审核权限过宽**
   - 位置：
     - [backend/app/modules/admin/dependencies.py](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/backend/app/modules/admin/dependencies.py:10)
     - [backend/app/api/routes/community.py](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/backend/app/api/routes/community.py:195)
   - 影响：`EDITOR` 可查看举报人 ID、举报详情并处理审核，缺少最小授权。
   - 下一步：新增 `MODERATOR` 或 `COMMUNITY_ADMIN` 权限，限制举报详情和审计日志可见范围。

3. **公网 API root 存在尾斜杠重定向循环**
   - 位置：
     - [deploy/ecs/nginx/beiyu-api.conf](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/deploy/ecs/nginx/beiyu-api.conf:13)
   - 证据：
     - `/api/v1`：301 到 `/api/v1/`
     - `/api/v1/`：307 回 `/api/v1`
   - 影响：具体接口可用，但 API root 和部分工具跟随重定向会失败。
   - 下一步：补 `location = /api/v1` 或调整 FastAPI/root path 与 Nginx proxy 规则。

### P2：产品体验和 Demo 真实性

1. **举报入口过轻**
   - 位置：
     - [src/app/post/[id].tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/app/post/[id].tsx:94)
     - [src/state/MixologyState.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/state/MixologyState.tsx:455)
   - 问题：原因固定为 `inappropriate`，没有分类、详情输入、二次确认；静态帖子暂不支持举报。
   - 下一步：做举报表单和重复举报处理。

2. **盲盒测试抽卡入口生产可见，且每日限制只在本地**
   - 位置：
     - [src/app/blind-box.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/app/blind-box.tsx:160)
     - [src/state/MixologyState.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/state/MixologyState.tsx:660)
   - 下一步：隐藏测试入口；如果盲盒有权益意义，改为后端配额。

3. **AI 模型下拉是伪入口**
   - 位置：
     - [src/app/ai.tsx](/Users/bailan/Documents/mx/ms/.worktrees/codex/stage3-ai-acceptance/src/app/ai.tsx:108)
   - 问题：标题带下拉图标，但点击是新建聊天，不是模型/模式菜单。
   - 下一步：删除下拉视觉或实现模型/模式菜单。

## 依赖审计

`npm audit --audit-level=moderate` 当前结果：

- 11 个 moderate。
- 主要来自 Expo 依赖链：`@expo/cli`、`@expo/config`、`@expo/config-plugins`、`expo`、`expo-splash-screen`、`uuid`、`xcode` 等。
- `npm audit fix --package-lock-only --dry-run` 没有给出安全自动修复动作。
- 不建议执行 `npm audit fix --force`，因为会触发 Expo/React Native 版本链破坏性变更。

建议：单独开 Expo 版本链升级任务，升级后重新跑 Simulator、Expo export、Jest、lint、typecheck。

## 下一步执行顺序

### 第 1 批：先保证公网 Demo 安全

1. 配置域名和 HTTPS。
2. 修复 Nginx `/api/v1` 重定向循环。
3. 修复可信代理 IP 解析和短信限流。
4. 拒绝占位密钥并轮换 ECS Demo secret。

### 第 2 批：修社区审核闭环质量

1. 拆分社区审核权限，避免 `EDITOR` 权限过宽。
2. 增加举报时间窗口频率限制。
3. 举报表单补原因、详情、确认。
4. 补运营审核后台 UI。

### 第 3 批：修前端假功能和体验误导

1. EAS production 禁止 placeholder 测试。
2. 个人页分享继续补复制链接、二维码、微信/QQ SDK。
3. 盲盒隐藏测试入口。
4. AI 标题下拉改成真实菜单或去掉。

### 第 4 批：上线前必须补齐

1. 媒体上传对象存储和审核。
2. 真实短信服务。
3. 真实实名服务。
4. 社区审核后台 UI。
5. 监控、告警、备份、日志留存。
6. App Store/TestFlight 和备案材料。
