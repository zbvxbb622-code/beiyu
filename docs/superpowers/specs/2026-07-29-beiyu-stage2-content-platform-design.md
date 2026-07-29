# 杯语 Stage 2 内容平台设计

> 状态：已确认
> 日期：2026-07-29
> 分支：`codex/backend-stage2-content`
> 前置阶段：Stage 1 账号、资料与私人酒柜

## 1. 目标

本阶段把前端内置的酒谱、配料、酒吧、酒品知识和首页配置转为可维护、可发布、可回滚的真实后端内容，同时保证 Expo 在后端未启动、网络不可用或接口异常时仍能正常打开并显示内容。

主要使用者：

- 普通用户：在手机端浏览已发布内容。
- 内容管理员：通过本地命令取得管理员权限，在 Swagger 中维护内容。
- 开发人员：在没有云服务器、云数据库和对象存储的情况下完成本地演示与自动化验证。

本阶段成功后，应能在本地完成“导入初始内容 -> 修改草稿 -> 发布 -> 手机端刷新显示 -> 关闭后端后继续显示”的完整流程。

## 2. 已确认决策

1. 使用专用业务表，不使用通用 JSON 内容库。
2. 使用现有 FastAPI、SQLModel/SQLAlchemy、Alembic 和 PostgreSQL。
3. 管理员沿用现有手机号登录和令牌体系，不增加第二套账号密码。
4. 内容维护使用 Swagger 与本地管理命令，不制作网页管理后台。
5. 手机端采用本地优先、后台刷新的方式，不让网络状态阻塞首屏。
6. 图片继续使用现有 `imageKey`；同时预留可空的网络图片地址。
7. 数据库内部使用 UUID，对外保留现有稳定编号，例如 `classic-margarita`。
8. 草稿、发布、下架和回滚均保留版本记录。
9. 本阶段不混入 AI、社区、通知、盲盒历史和真实媒体上传。

## 3. 技术栈

### 3.1 后端

- Python 3.12
- FastAPI
- SQLModel / SQLAlchemy
- PostgreSQL
- Alembic
- Pydantic
- Pytest
- Ruff
- ty

### 3.2 手机端

- Expo 57
- React Native 0.86
- TypeScript
- AsyncStorage
- Jest
- Zod，用于校验来自网络和本地缓存的内容结构

Zod 是本阶段唯一计划新增的手机端运行依赖。它只负责数据边界校验，不参与界面渲染或状态管理。

### 3.3 开源参考

实现参考 MIT 许可的 [FastAPI Full Stack Template](https://github.com/fastapi/full-stack-fastapi-template) 中以下成熟做法：

- 数据库初始化与可重复执行的种子数据。
- Alembic 迁移和 PostgreSQL 测试库隔离。
- Pydantic 请求、响应模型和 OpenAPI 合同。
- Pytest API 集成测试。
- Docker Compose 与 GitHub Actions 质量门禁。

只借鉴适合当前项目的结构和测试方式，不替换已经跑通的认证、配置、日志、错误处理和 Docker 基础。

## 4. 系统结构

```mermaid
flowchart LR
    A["Expo 页面"] --> B["内容仓库 Content Repository"]
    B --> C["内存数据"]
    B --> D["AsyncStorage 缓存"]
    B --> E["应用内置内容"]
    B --> F["FastAPI 公开接口"]
    F --> G["内容服务"]
    G --> H["PostgreSQL"]
    I["Swagger / 本地管理命令"] --> J["管理员鉴权"]
    J --> K["内容管理服务"]
    K --> H
    K --> L["内容版本记录"]
```

内容读取顺序：

1. 页面立即使用内存、缓存或应用内置内容。
2. 后台请求公开接口。
3. 响应通过 Zod 校验后更新内存和缓存。
4. 超时、断网、非 2xx 或结构校验失败时保留当前内容。
5. 用户主动刷新失败时显示简短提示；后台刷新失败不打断用户。

## 5. 模块职责

### 5.1 `content` 后端模块

负责：

- 配料、酒谱、酒吧、酒品知识和首页配置查询。
- 只向公开接口暴露已发布内容。
- 草稿保存、发布、下架、版本查询和回滚。
- 稳定排序、分页、筛选和基础搜索。
- 初始内容的幂等导入。

不负责：

- 用户评论、点赞和收藏。
- AI 推荐。
- 图片上传与审核。
- 云存储签名。

### 5.2 `admin` 后端模块

负责：

- 管理员角色检查。
- 内容管理接口。
- 本地提升和撤销管理员角色的命令。

管理员仍通过现有 OTP 登录流程取得访问令牌。管理接口必须同时验证登录状态和角色。

### 5.3 手机端内容仓库

负责：

- 统一封装网络、缓存和内置内容。
- 向页面提供稳定的类型和刷新状态。
- 在后台更新时避免页面闪烁。
- 对无效响应和旧缓存执行安全降级。

页面不直接调用 `fetch`，也不直接读写 AsyncStorage。

## 6. 数据库设计

### 6.1 公共约定

所有内容表具备：

- `id`：数据库内部 UUID。
- `public_id`：对外稳定编号，唯一且创建后不可修改。
- `status`：`DRAFT`、`PUBLISHED` 或 `ARCHIVED`。
- `revision`：从 1 开始递增的乐观锁版本号。
- `published_at`：最后发布时间，可空。
- `created_at`、`updated_at`。

公开接口返回 `public_id` 作为 `id`，不暴露内部 UUID。

图片采用：

- `image_key`：应用内置资源编号，可空。
- `image_url`：未来 CDN 地址，可空。

本阶段导入的数据全部使用 `image_key`。至少一个图片字段存在的约束由业务模型按内容类型校验。

### 6.2 用户角色

在 `users` 表增加 `role`：

- `USER`
- `EDITOR`
- `SUPER_ADMIN`

默认值为 `USER`。Stage 2 的内容维护要求 `EDITOR` 或 `SUPER_ADMIN`。

### 6.3 `ingredients`

字段：

- `id`
- `public_id`
- `name`
- `category`
- `description`
- `image_key`
- `image_url`
- 公共状态与时间字段

类别沿用前端现有取值：

- `base`
- `liqueur`
- `citrus`
- `mixer`
- `sweetener`
- `garnish`
- `tool`

### 6.4 `recipes`

字段：

- `id`
- `public_id`
- `name`
- `english_name`
- `description`
- `tags`
- `steps`
- `image_key`
- `image_url`
- `difficulty`
- `prep_minutes`
- 公共状态与时间字段

难度对外继续返回：

- `入门`
- `进阶`
- `专业`

### 6.5 `recipe_ingredients`

字段：

- `recipe_id`
- `ingredient_id`
- `amount`
- `sort_order`

联合唯一约束为 `recipe_id + ingredient_id`。通过关联表保留配料关系，便于后续按用户酒柜匹配酒谱。

### 6.6 `bars`

字段：

- `id`
- `public_id`
- `name`
- `description`
- `image_key`
- `image_url`
- `rating`
- `review_count`
- `average_spend`
- `distance_label`
- `metro_hint`
- `address`
- `open_hours`
- `tags`
- `taste_score`
- `environment_score`
- `service_score`
- `phone`
- `latitude`
- `longitude`
- `menu`
- `featured_reviews`
- 公共状态与时间字段

`menu` 和 `featured_reviews` 是后台维护的编辑内容，使用经过 Pydantic 校验的 JSONB。未来真实用户评论使用独立社区表，不写入 `featured_reviews`。

### 6.7 `drink_knowledge_entries`

字段：

- `id`
- `public_id`
- `recipe_id`，可空
- `name`
- `english_name`
- `image_key`
- `image_url`
- `era`
- `meaning`
- `story`
- `symbols`
- 公共状态与时间字段

### 6.8 `home_banners`

字段：

- `id`
- `public_id`
- `brand`
- `title`
- `subtitle`
- `script_label`
- `cta_label`
- `target_route`
- `image_key`
- `image_url`
- `sort_order`
- `starts_at`
- `ends_at`
- 公共状态与时间字段

只有状态已发布且处于有效时间范围内的横幅会出现在首页接口中。

### 6.9 `home_shortcuts`

字段：

- `id`
- `public_id`
- `title`
- `description`
- `icon`
- `route`
- `sort_order`
- 公共状态与时间字段

`icon` 和 `route` 必须通过允许列表校验，避免后台内容触发不存在或不安全的页面。

### 6.10 `content_versions`

字段：

- `id`
- `content_type`
- `content_id`
- `version_no`
- `snapshot`
- `action`
- `created_by_admin_id`
- `created_at`

`action` 取值：

- `CREATE`
- `UPDATE`
- `PUBLISH`
- `ARCHIVE`
- `ROLLBACK`

每次成功修改都写入不可变快照。回滚不会直接覆盖线上版本，而是根据指定快照生成新的草稿版本。

## 7. 发布与并发规则

1. 新建内容默认是草稿。
2. 草稿可重复修改，每次修改增加 `revision` 并保存版本。
3. 修改请求必须携带 `expectedRevision`。
4. 数据库当前版本与 `expectedRevision` 不一致时返回 HTTP 409。
5. 发布前执行完整字段和关联校验。
6. 公开接口只读取 `PUBLISHED`。
7. 下架把状态改为 `ARCHIVED`，不物理删除。
8. 已发布或已下架内容不提供物理删除接口。
9. 回滚创建新草稿，由管理员再次确认发布。

## 8. 初始数据导入

将以下前端数据转换为后端可读取的规范种子文件：

- `src/data/ingredients.ts`
- `src/data/recipes.ts`
- `src/data/drinkKnowledge.ts`
- `src/data/content.ts` 中的 `heroSlides`
- `src/data/content.ts` 中的 `homeShortcuts`
- `src/data/content.ts` 中的 `barVenues`

社区帖子和共享酒柜数据不进入 Stage 2 种子文件。

导入命令必须：

- 可重复执行。
- 以 `public_id` 作为幂等键。
- 默认不覆盖管理员已经修改的数据。
- 提供显式 `--update-existing` 选项用于开发环境同步种子内容。
- 输出创建、跳过和更新数量。
- 遇到无效数据时整体失败，不留下半批数据。

## 9. 公开接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/home` | 横幅、快捷入口和首页推荐 |
| GET | `/api/v1/ingredients` | 已发布配料 |
| GET | `/api/v1/recipes` | 酒谱列表 |
| GET | `/api/v1/recipes/{publicId}` | 酒谱详情 |
| GET | `/api/v1/bars` | 酒吧列表 |
| GET | `/api/v1/bars/{publicId}` | 酒吧详情 |
| GET | `/api/v1/knowledge` | 酒品知识列表 |
| GET | `/api/v1/knowledge/{publicId}` | 酒品知识详情 |
| GET | `/api/v1/search` | 酒谱、酒吧和知识搜索 |

列表接口支持：

- `page`
- `pageSize`
- `query`
- `tag`
- `sortBy`
- `sortOrder`

默认 `pageSize` 为 20，最大为 100。响应统一包含 `items` 和 `pagination`。

公开接口字段使用 camelCase，并直接匹配手机端类型。列表排序必须稳定，相同排序值时使用 `public_id` 作为第二排序键。

## 10. 管理接口

### 10.1 通用能力

每类内容提供：

- 管理列表，包含草稿、已发布和已下架。
- 创建草稿。
- 修改草稿。
- 发布。
- 下架。
- 查看版本列表。
- 根据指定版本生成回滚草稿。

接口路径保持资源化，例如：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/admin/recipes` | 管理酒谱列表 |
| POST | `/api/v1/admin/recipes` | 创建酒谱草稿 |
| PATCH | `/api/v1/admin/recipes/{publicId}` | 修改酒谱 |
| POST | `/api/v1/admin/recipes/{publicId}/publish` | 发布酒谱 |
| POST | `/api/v1/admin/recipes/{publicId}/archive` | 下架酒谱 |
| GET | `/api/v1/admin/recipes/{publicId}/versions` | 版本列表 |
| POST | `/api/v1/admin/recipes/{publicId}/rollback` | 生成回滚草稿 |

配料、酒吧、知识、横幅和快捷入口使用同样的命名规则。

### 10.2 本地管理命令

计划提供：

```bash
uv run python -m app.cli promote-admin --phone +8613800000000 --role EDITOR
uv run python -m app.cli revoke-admin --phone +8613800000000
uv run python -m app.cli seed-content
uv run python -m app.cli seed-content --update-existing
```

手机号在查询前使用现有规范化和哈希流程，命令不打印完整手机号、令牌或其他敏感信息。

## 11. 错误合同

沿用现有统一错误包络：

```json
{
  "error": {
    "code": "CONTENT_REVISION_CONFLICT",
    "message": "Content has changed. Refresh and try again.",
    "details": {}
  }
}
```

主要状态码：

- 400：查询参数或操作组合无效。
- 401：未登录。
- 403：没有管理员权限。
- 404：内容不存在或公开内容未发布。
- 409：`public_id` 重复或版本冲突。
- 422：内容字段或关联校验失败。
- 500：服务器错误，不暴露内部异常。

## 12. 手机端接入

### 12.1 配置

新增：

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

规则：

- 未配置时进入纯本地模式。
- 不在源码中写死局域网 IP。
- URL 必须使用 `http` 或 `https`。
- 生产构建必须配置 HTTPS 地址。

### 12.2 内容仓库行为

内容仓库提供：

- `getSnapshot()`：同步取得当前可显示内容。
- `refresh()`：后台拉取并更新。
- `subscribe()`：通知 React 页面内容已变化。
- `clearCache()`：仅用于测试、退出账号清理或故障恢复。

来源优先级：

1. 当前内存数据。
2. 通过校验的 AsyncStorage 缓存。
3. 应用内置数据。

网络响应成功后成为新的内存数据和缓存。缓存带有：

- `schemaVersion`
- `fetchedAt`
- `payload`

缓存版本不兼容或结构校验失败时直接丢弃，回退到应用内置数据。

### 12.3 页面改造

以下页面改为订阅内容仓库：

- 首页
- 酒谱列表与详情
- 酒吧列表与详情
- 酒品知识
- 搜索
- 发布帖子中的酒吧选择器

首屏不增加全页加载状态。后台刷新时保留当前内容；用户主动下拉刷新时显示现有页面内刷新状态。

## 13. 搜索

第一版使用 PostgreSQL 基础搜索：

- 酒谱：中英文名称、描述和标签。
- 酒吧：名称、地址、描述和标签。
- 酒品知识：中英文名称、寓意、故事和象征标签。

结果包含：

- `type`
- `id`
- `title`
- `subtitle`
- `imageKey`
- `imageUrl`

本阶段不引入 Elasticsearch、向量数据库或复杂推荐。社区帖子继续保留本地搜索，等社区模块上线后统一。

## 14. 项目结构

计划新增或扩展：

```text
backend/app/
  api/routes/
    content.py
    admin_content.py
  cli/
    __init__.py
    __main__.py
  db/models/
    content.py
  modules/
    content/
      schemas.py
      service.py
      repository.py
      seed.py
  seeds/content/
    ingredients.json
    recipes.json
    bars.json
    knowledge.json
    home.json

src/
  services/content/
    apiClient.ts
    contentRepository.ts
    contentSchemas.ts
    bundledContent.ts
  state/
    ContentState.tsx
```

测试跟随现有目录约定，后端 API 测试放在 `backend/tests/api/`，数据库与种子测试放在 `backend/tests/db/` 和 `backend/tests/modules/`，手机端服务测试放在 `src/services/__tests__/`，页面行为测试保留在组件测试目录。

## 15. 代码约定

后端：

- API 路由只负责参数、鉴权和响应。
- 业务规则放在 service。
- 数据库查询放在 repository。
- 所有外部输入使用 Pydantic 校验。
- 响应模型继承 `ApiModel`，保持 camelCase。
- 不使用字符串拼接构造 SQL。

手机端：

- 页面不直接访问网络和缓存。
- 网络与缓存响应必须先经过 Zod。
- 业务类型继续使用 `src/types/mixology.ts`。
- 不在渲染期间触发异步副作用。
- 后台刷新失败不清空已有数据。

## 16. 测试策略

### 16.1 后端

必须覆盖：

- 新迁移可以从空库执行。
- 每个模型的约束、外键和唯一键。
- 种子数据首次导入、重复导入、显式更新和事务回滚。
- 公开接口只返回已发布内容。
- 管理员角色允许和拒绝路径。
- 创建、修改、发布、下架和回滚。
- `expectedRevision` 冲突。
- 详情 404、分页、筛选、排序和搜索。
- OpenAPI 包含全部新接口和错误模型。

### 16.2 手机端

必须覆盖：

- 未配置 API 地址时使用内置内容。
- 缓存有效时先显示缓存。
- 缓存损坏或版本不兼容时回退。
- 网络成功后更新内容和缓存。
- 超时、非 2xx、无效 JSON 和结构错误时保留当前内容。
- 页面初次渲染不因异步请求出现空白。
- 主动刷新成功和失败状态。
- 现有静态服务调用迁移后的兼容行为。

### 16.3 集成验证

- Expo lint、TypeScript 和 Jest。
- 后端 Ruff、ty 和 Pytest。
- Alembic 空库迁移。
- OpenAPI 生成一致性。
- Docker 镜像构建。
- Docker Compose 启动、健康检查和公开接口冒烟测试。

## 17. 开发命令

手机端：

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npx expo start
```

后端：

```bash
cd backend
uv sync --frozen
uv run ruff check .
uv run ty check
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run alembic upgrade head
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest
docker compose up --build
```

## 18. 安全与边界

始终执行：

- 管理接口进行登录和角色双重校验。
- 输入长度、枚举、URL、路由和关联关系校验。
- 使用参数化数据库查询。
- 公开接口过滤草稿和下架内容。
- 错误响应隐藏内部堆栈和数据库细节。
- 提交前运行完整检查。

需要再次确认后才能执行：

- 增加网页管理后台。
- 接入对象存储或真实图片上传。
- 改变公开接口字段含义。
- 让种子命令默认覆盖管理员内容。
- 引入搜索集群、消息队列或新的云服务。

禁止：

- 提交密钥、令牌、真实短信配置或生产数据库地址。
- 在代码中写死开发电脑 IP。
- 让手机端因为网络失败清空内容。
- 物理删除已发布内容和版本历史。
- 将社区帖子或用户评价伪装成后台精选内容导入。

## 19. 不在本阶段

- 真实 OSS/CDN 上传、审核和签名 URL。
- 网页管理后台。
- AI 会话、AI 记忆和模型调用。
- 社区帖子、评论、点赞、收藏、关注和举报。
- 盲盒真实历史。
- 通知与推送。
- 云服务器、云数据库和正式域名部署。
- Elasticsearch、向量搜索和推荐系统。

## 20. 验收标准

1. 现有前端内容可完整、幂等地导入 PostgreSQL。
2. 管理员可在 Swagger 完成创建、修改、发布、下架和回滚。
3. 普通用户无法访问任何管理接口。
4. 手机端可读取已发布的首页、配料、酒谱、酒吧和知识数据。
5. 草稿和已下架内容不会出现在公开接口。
6. 手机端在后端关闭、超时或返回错误数据时仍能正常打开。
7. 联网成功后内容更新并写入本地缓存。
8. 现有前端稳定编号、路由和内置图片继续有效。
9. 所有新增接口出现在 OpenAPI 中。
10. 前端和后端的 lint、类型检查、测试、迁移与 Docker 冒烟检查全部通过。

## 21. 本地验收脚本

最终人工验收顺序：

1. 启动 PostgreSQL 和 FastAPI。
2. 执行内容种子导入。
3. 使用开发 OTP 登录指定手机号。
4. 将该手机号提升为 `EDITOR`。
5. 在 Swagger 修改一条酒谱草稿并发布。
6. 在 Expo 中刷新并看到新内容。
7. 关闭 FastAPI。
8. 重新打开 Expo，确认缓存或内置内容仍能显示。
9. 恢复 FastAPI，执行版本回滚并再次发布。
10. 确认手机端显示回滚后的内容。

## 22. 当前开放项

没有阻断实现的开放项。

未来接入对象存储时，再决定网络图片与内置 `imageKey` 的最终优先级和媒体审核流程；在此之前，手机端优先使用有效的 `imageUrl`，失败时回退 `imageKey`。
