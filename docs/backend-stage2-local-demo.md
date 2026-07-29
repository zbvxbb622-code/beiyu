# 杯语 Stage 2 本地内容平台演示

这份流程用于验证一条完整链路：

`导入初始内容 -> 手机号登录 -> 提升内容管理员 -> 新建并发布 -> Expo 刷新 -> 断开后端继续显示 -> 版本回滚`

所有命令都在项目根目录执行，示例手机号和密码只用于本机开发。

## 1. 启动数据库

```bash
cd backend
cp .env.example .env
docker compose up -d db db-test
uv sync --frozen
set -a && . ./.env && set +a
uv run alembic upgrade head
uv run python -m app.cli seed-content
uv run python -m app.cli seed-content
```

第二次导入应显示没有新增记录，证明导入可重复执行，不会覆盖运营人员已经修改的内容。

启动接口服务：

```bash
make dev
```

浏览器打开：

- Swagger：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health/ready`
- 首页内容：`http://localhost:8000/api/v1/home`

## 2. 手机号登录

另开一个终端：

```bash
curl -X POST http://localhost:8000/api/v1/auth/sms-codes \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","scene":"LOGIN","installationId":"stage2-demo-device"}'
```

本地开发验证码固定为 `123456`：

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","code":"123456","device":{"installationId":"stage2-demo-device","platform":"IOS","deviceName":"Stage 2 Demo","appVersion":"1.0.0"}}'
```

保留响应中的 `accessToken`。先登录一次是为了在数据库中创建该用户。

## 3. 提升内容管理员

在已加载 `backend/.env` 的终端执行：

```bash
uv run python -m app.cli promote-admin \
  --phone +8613800138000 \
  --role EDITOR
```

返回 Swagger，点击右上角 **Authorize**，填入刚才的 `accessToken`。不要添加额外的 `Bearer` 前缀，Swagger 会自动处理。

可先调用 `GET /api/v1/admin/recipes`。返回 200 且能看到草稿、已发布和已下架内容，说明权限生效。

## 4. 新建并发布首页横幅

在 Swagger 调用 `POST /api/v1/admin/banners`：

```json
{
  "id": "stage2-demo-banner",
  "brand": "Beiyu",
  "title": "（后台内容",
  "subtitle": "已经接通）",
  "scriptLabel": "Stage 2",
  "ctaLabel": "查看酒谱",
  "targetRoute": "/recipes",
  "imageKey": "homeBanner",
  "sortOrder": 0
}
```

响应应为 `DRAFT`、`revision: 1`。草稿不会出现在公开首页。

调用 `POST /api/v1/admin/banners/stage2-demo-banner/publish`：

```json
{
  "expectedRevision": 1
}
```

再次打开 `GET /api/v1/home`，应能看到新横幅。

## 5. 连接 Expo

回到项目根目录。创建本机私有的 `.env.local`：

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

然后启动：

```bash
npm install
npm start
```

地址选择：

- iOS 模拟器通常可使用 `127.0.0.1`。
- Android 模拟器通常使用 `10.0.2.2` 替代 `127.0.0.1`。
- 真机需要填写电脑的局域网地址，并确保手机与电脑处于同一网络。

打开首页或下拉刷新。App 会先显示内置或缓存内容，再在后台读取新发布内容；网络请求不会阻塞首屏。

## 6. 验证断网兜底

先让 Expo 成功刷新一次，再停止接口服务：

```bash
# make dev 所在终端按 Ctrl+C
```

完全关闭并重新打开 App。预期结果：

- App 正常打开，不停在加载页。
- 首页图片和内容仍然存在。
- 有有效缓存时显示缓存；缓存损坏时回到应用内置内容。
- 下拉刷新失败只提示继续使用现有内容，不会清空页面。

未配置 `EXPO_PUBLIC_API_BASE_URL` 时，App 会直接进入纯本地模式，也不会发起网络请求。

## 7. 验证版本与回滚

重新启动接口：

```bash
cd backend
set -a && . ./.env && set +a
make dev
```

在 Swagger 查看：

`GET /api/v1/admin/banners/stage2-demo-banner/versions`

选择一个早期 `versionNo`，调用：

`POST /api/v1/admin/banners/stage2-demo-banner/rollback`

```json
{
  "expectedRevision": 2,
  "versionNo": 1
}
```

回滚结果应是新的 `DRAFT`，修订号增加，并暂时从公开首页隐藏。确认内容后，再用新的 `expectedRevision` 发布回滚草稿，Expo 下拉刷新即可看到变化。

## 8. 清理演示内容

不需要物理删除。调用：

`POST /api/v1/admin/banners/stage2-demo-banner/archive`

请求中的 `expectedRevision` 必须使用当前最新修订号。下架后，公开首页不再返回该横幅，历史版本仍可审计。
