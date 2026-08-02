# 杯语 Demo 剩余问题清单（2026-08-02 修复后）

## 本轮已修复

- 删除前端私人酒柜入口、页面和对应测试；`/cellar` 旧路由回到个人页。
- 移除生产展示文案中的“我的酒柜 / 私人酒柜”残留，发布话题不再出现酒柜标签。
- 账号与安全中“登录密码”“微信账号”“官方认证”不再执行本地假状态，统一展示“暂未开放”。
- 官方认证直达页改为“暂未开放”，不再展示认证类型选择和提交按钮。
- 设置页“帮助与客服”、通用设置“字体大小 / 深色模式”、系统权限状态改为暂未开放或空状态，不再展示静态假授权结果。
- 注销账号时显式清理用户 AI 会话、消息、记忆、配额、社区帖子、评论和点赞；AI usage log 保留但解除 conversation 关联。

## 仍需上线前完成

1. **社区审核与举报后台缺失**
   - 当前已有帖子、评论、点赞、回复基础链路，但缺少举报表、审核状态、后台处理页和审核审计日志。
   - 建议优先补：`community_reports`、帖子/评论 `moderation_status`、管理员审核 API、前端举报入口。

2. **图片上传仍需生产级对象存储**
   - Demo 内置图片和本地相册图片展示可用于演示，但上线需要接入 OSS/S3/R2 等对象存储、图片压缩、鉴黄/审核、访问 URL 签名或 CDN。

3. **实名认证不是公安/第三方实名核验**
   - 当前适合做年龄门槛和身份证格式/年龄校验 demo。
   - 上线如涉及真实实名，需要接入合规实名服务，并补充失败、人工复核、数据最小化和留存策略。

4. **暂未开放功能需要产品决策**
   - 已明确标记：密码登录/改密、微信绑定、官方认证、帮助与客服、字体大小、深色模式、系统权限实时状态。
   - 可以继续保持隐藏/暂未开放，也可以排期接真实后端和系统 API。

5. **依赖审计**
   - `npm ci` 报告 11 个 moderate severity 依赖问题。
   - 不建议直接 `npm audit fix --force`，需要单独评估 Expo / React Native 兼容性后升级。

6. **本地密钥管理**
   - `backend/.env` 被 `.gitignore` 忽略，未进入 git；但 `docker compose config` 会读取本地 `.env` 并打印密钥。
   - 建议立即轮换本地 AI key，并避免把 compose config 原始输出发给外部。

7. **缺少真正的 iOS 端到端自动化脚本**
   - 当前已覆盖 Jest、Pytest、Expo export 和 Docker build。
   - 还没有 Detox/Maestro/Appium 这类可重复点击完整 App 的自动化脚本；人工 Simulator 验收仍需要按 runbook 执行。

## 本轮验证结果

- `npm ci`：通过；提示 11 个 moderate 依赖审计项。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test -- --runInBand`：通过，83 个 test suites / 356 个 tests。
- `npx expo export --platform ios`：通过，输出到 `dist`。
- `uv sync --frozen`：通过。
- `uv run ruff check .`：通过。
- `uv run ty check`：通过。
- `BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest`：通过，472 个 tests。
- `docker compose --env-file /dev/null config`（在 `backend` 目录）：通过。
- `docker compose build api`（在 `backend` 目录）：通过。

