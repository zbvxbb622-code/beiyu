# 杯语 Stage 3 本地 AI 后端演示

这份流程用于验证一条完整的 AI 后端链路：

`数据库迁移 -> 手机号登录 -> 年龄确认 -> 创建普通会话 -> 发送消息 -> 查看记忆和额度 -> 临时聊天 -> 删除会话`

所有命令都在项目根目录执行，示例手机号、验证码和 token 只用于本机开发。

## 1. 启动后端

```bash
cd backend
cp .env.example .env
docker compose up -d db db-test
uv sync --frozen
set -a && . ./.env && set +a
uv run alembic upgrade head
uv run python -m app.cli seed-content
make dev
```

浏览器打开：

- Swagger：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health/ready`
- OpenAPI：`http://localhost:8000/openapi.json`

开发环境默认使用 `BEIYU_AI_PROVIDER=development`。这个 Provider 是本地确定性实现，不需要 API Key，也不会产生模型费用。

## 2. 登录并确认年龄

请求开发验证码：

```bash
curl -X POST http://localhost:8000/api/v1/auth/sms-codes \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","scene":"LOGIN","installationId":"stage3-ai-demo-device"}'
```

用固定验证码 `123456` 登录：

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","code":"123456","device":{"installationId":"stage3-ai-demo-device","platform":"IOS","deviceName":"Stage 3 AI Demo","appVersion":"1.0.0"}}'
```

保存响应中的 `accessToken`：

```bash
export ACCESS_TOKEN="粘贴 accessToken"
```

确认达到合法饮酒年龄：

```bash
curl -X POST http://localhost:8000/api/v1/me/age-confirmation \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"confirmed":true}'
```

如果未确认年龄，AI 接口会返回 `AGE_CONFIRMATION_REQUIRED`。

## 3. 创建普通会话

调用：

`POST /api/v1/ai/conversations`

```bash
curl -X POST http://localhost:8000/api/v1/ai/conversations \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

保存响应中的会话 ID：

```bash
export CONVERSATION_ID="粘贴 id"
```

空会话不会出现在会话列表中。只有成功产生消息后，`GET /api/v1/ai/conversations` 才会返回它。

## 4. 发送普通消息

调用：

`POST /api/v1/ai/conversations/{conversationId}/messages`

```bash
curl -X POST "http://localhost:8000/api/v1/ai/conversations/$CONVERSATION_ID/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"我喜欢清爽、低甜的饮品。","clientMessageId":"11111111-1111-4111-8111-111111111111"}'
```

预期响应包含：

- `conversation`
- `userMessage`
- `assistantMessage`
- `usage`
- `memoryChanges`

开发 Provider 会稳定返回一段本地回复；如果内容明确表达长期偏好，后端会经过安全过滤后写入 AI 记忆。

再次发送同一个 `clientMessageId` 会返回同一次普通聊天结果，不会重复调用 Provider，也不会重复扣额度。

## 5. 查看消息、记忆和额度

会话详情：

`GET /api/v1/ai/conversations/{conversationId}`

```bash
curl "http://localhost:8000/api/v1/ai/conversations/$CONVERSATION_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

消息列表：

`GET /api/v1/ai/conversations/{conversationId}/messages`

```bash
curl "http://localhost:8000/api/v1/ai/conversations/$CONVERSATION_ID/messages?page=1&pageSize=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

记忆列表：

`GET /api/v1/ai/memories`

```bash
curl http://localhost:8000/api/v1/ai/memories \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

今日额度：

`GET /api/v1/ai/usage/today`

```bash
curl http://localhost:8000/api/v1/ai/usage/today \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

额度按北京时间自然日统计。普通聊天和临时聊天共用每日额度。

## 6. 关闭和删除记忆

关闭记忆写入和读取：

`PATCH /api/v1/ai/memory-settings`

```bash
curl -X PATCH http://localhost:8000/api/v1/ai/memory-settings \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false}'
```

关闭不会删除已有记忆，用户仍可以查看和删除。

删除一条记忆：

`DELETE /api/v1/ai/memories/{memoryId}`

```bash
curl -X DELETE "http://localhost:8000/api/v1/ai/memories/粘贴-memory-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

清空全部记忆：

`DELETE /api/v1/ai/memories`

```bash
curl -X DELETE http://localhost:8000/api/v1/ai/memories \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

用户主动删除记忆时，后端会先写入不可逆 HMAC tombstone，再删除摘要和来源，防止旧聊天把已删除记忆偷偷学回来。

## 7. 临时聊天

调用：

`POST /api/v1/ai/temporary-messages`

```bash
curl -X POST http://localhost:8000/api/v1/ai/temporary-messages \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"继续刚才的话题。","clientMessageId":"22222222-2222-4222-8222-222222222222","context":[{"role":"USER","content":"今天不太顺利。"},{"role":"ASSISTANT","content":"我在。你可以慢慢说。"}]}'
```

临时聊天的请求上下文会送入 Provider，但不会写入：

- `ai_messages`
- `ai_memories`
- `ai_memory_sources`
- `responseMessageId`

它只保留不含正文的请求、额度和用量元数据。

如果临时聊天已经成功，但客户端丢失响应后用同一个 `clientMessageId` 重试，后端返回：

`TEMPORARY_RESPONSE_NOT_RETAINED`

这表示后端不会为了恢复临时回复而保存正文，也不会再次调用 Provider 或再次扣额度。

## 8. 安全与失败路径

固定安全回复会绕过 Provider，但仍算一次成功 AI 回复并占用额度。例如严重自伤危机会返回后端固定安全话术，不推荐酒，也不把危机内容写入记忆。

Provider 超时返回：

- `AI_PROVIDER_TIMEOUT`
- HTTP `504`

Provider 不可用或无效响应返回：

- `AI_PROVIDER_UNAVAILABLE`
- HTTP `503`

这些失败会释放额度预留，不会保存聊天消息。

## 9. 删除会话

调用：

`DELETE /api/v1/ai/conversations/{conversationId}`

```bash
curl -X DELETE "http://localhost:8000/api/v1/ai/conversations/$CONVERSATION_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

删除会话会硬删除消息，并删除仅来源于该会话的记忆。用量记录会保留，但会话和消息外键会置空，不保留聊天正文。

## 10. 验收命令

后端完整验证：

```bash
cd backend
uv run ruff check .
uv run ty check
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest
docker compose config
docker compose build api
```

OpenAPI 发生有意变更后重新生成：

```bash
cd backend
BEIYU_ENVIRONMENT=dev \
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu@localhost:5433/beiyu_test \
BEIYU_SECRET_KEY=change-me \
uv run python scripts/generate_openapi.py
```
