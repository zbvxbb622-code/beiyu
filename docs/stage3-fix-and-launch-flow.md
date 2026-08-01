# Stage 3 修复与上线部署流程图

```mermaid
flowchart TD
  A["当前 Stage 3 PR<br/>codex/stage3-ai-acceptance"] --> B{"质量门是否通过？"}
  B -->|"否"| C["修复 lint / typecheck / tests / build"]
  C --> D["本地复跑完整验证"]
  D --> B
  B -->|"是"| E{"依赖审计是否有 high / critical？"}
  E -->|"有"| F["优先修复高危依赖<br/>避免 audit fix --force 破坏 Expo 版本"]
  F --> G["npm audit --audit-level=high"]
  G --> E
  E -->|"无"| H{"是否还有 moderate？"}
  H -->|"有"| I["记录为上线前风险<br/>评估 Expo 官方升级路径"]
  H -->|"无"| J["依赖风险清零"]
  I --> K["真实 iOS Simulator 验收"]
  J --> K
  K --> L{"22-step acceptance 是否全 PASS？"}
  L -->|"否"| M["修复验收缺口<br/>复测隐私与持久化"]
  M --> N["更新验收报告"]
  N --> L
  L -->|"是"| O["准备 staging 环境"]
  O --> P["配置 Postgres / Secret / SMS / AI / CORS / API URL"]
  P --> Q["部署后端容器"]
  Q --> R["运行 Alembic migration"]
  R --> S["健康检查 /health/ready"]
  S --> T{"Staging smoke 是否通过？"}
  T -->|"否"| U["回滚或修复<br/>查看日志和错误监控"]
  U --> Q
  T -->|"是"| V["前端指向 staging /api/v1"]
  V --> W["iOS export / TestFlight 或内部分发"]
  W --> X["团队灰度验收"]
  X --> Y{"是否达到上线阈值？"}
  Y -->|"否"| U
  Y -->|"是"| Z["生产部署"]
  Z --> AA["生产健康检查和关键路径 smoke"]
  AA --> AB["首小时监控<br/>错误率 / P95 延迟 / 日志 / AI Provider"]
  AB --> AC{"指标是否正常？"}
  AC -->|"否"| AD["执行回滚<br/>恢复上一镜像或关闭入口"]
  AC -->|"是"| AE["扩大灰度 / 正式发布"]
```

## 当前已处理

- 已移除前端依赖审计中的 high 风险 `brace-expansion`：通过 `overrides` 固定到安全版本。
- 已删除未使用的直接依赖 `@expo/ngrok`，避免旧 `uuid@3.4.0` 进入项目依赖树。
- 当前 PR backend/frontend GitHub checks 已通过，分支可合并。
- 已自动跑通 iOS Simulator 核心验收：登录、普通 AI 消息、历史恢复、临时聊天不进历史、删除普通会话并保留 usage。

## 当前仍需上线前处理

- `npm audit` 仍有 Expo 依赖链上的 moderate 风险；不要直接执行 `npm audit fix --force`，需要单独评估 Expo 57 官方升级版本。
- Expo Go 的 iOS `Cache.db-wal` 会暂存临时聊天 POST 请求体；上线前需要用原生 dev client 或生产 iOS build 复测，并禁用/清理原生 URL cache 后再关闭该隐私验收缺口。
- staging/prod 需要真实环境变量：数据库、短信服务、AI 服务、密钥、CORS、前端 API URL。
