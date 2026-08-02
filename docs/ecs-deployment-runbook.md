# ECS 后端部署 Runbook

## 当前结论

这套配置可以把杯语后端部署到阿里云 ECS，供 Expo / iOS Demo 连接真实 API、Postgres 和 AI。

当前代码还不能作为完整商用生产环境启动，原因是短信供应商只有 development provider。`prod` / `staging` 会拒绝固定验证码。正式商用前需要先实现真实短信 provider。

## 服务器要求

- Ubuntu 22.04
- Docker Engine + Docker Compose v2
- Nginx
- 安全组开放：
  - `22`：仅限你的办公 IP
  - `80`：HTTP Demo 或证书签发
  - `443`：HTTPS
  - 不建议公网开放 `5432` / `8000`

## 目录约定

```text
/opt/beiyu
├── backend
├── deploy
└── .env
```

## 首次部署

```bash
sudo mkdir -p /opt/beiyu
sudo chown -R "$USER":"$USER" /opt/beiyu

cd /opt/beiyu
git clone https://github.com/zbvxbb622-code/beiyu.git .
git checkout codex/stage3-ai-acceptance

cp deploy/ecs/server.env.example .env
chmod 600 .env
```

编辑 `/opt/beiyu/.env`，至少替换：

- `BEIYU_COMPOSE_POSTGRES_PASSWORD`
- `BEIYU_COMPOSE_DATABASE_URL`
- `BEIYU_SECRET_KEY`
- `BEIYU_AI_MODEL`
- `BEIYU_AI_API_KEY`
- `BEIYU_AI_MEMORY_HMAC_KEY`

生成随机密钥：

```bash
openssl rand -base64 48
```

启动服务：

```bash
docker compose --env-file .env -f deploy/ecs/compose.yml up -d --build
docker compose --env-file .env -f deploy/ecs/compose.yml ps
```

如果服务器拉取基础镜像不稳定，可以先在本地构建并传输镜像：

```bash
docker buildx build --platform linux/amd64 -t ecs-api:amd64 --load backend
docker save ecs-api:amd64 postgres:16 | gzip | ssh root@120.26.28.208 'gunzip | docker load'
ssh root@120.26.28.208 'docker tag ecs-api:amd64 ecs-api:latest'
```

然后在服务器使用已加载镜像启动：

```bash
docker compose --env-file .env \
  -f deploy/ecs/compose.yml \
  -f deploy/ecs/compose.image.yml \
  up -d
```

导入内置内容：

```bash
docker compose --env-file .env -f deploy/ecs/compose.yml exec api \
  python -m app.cli seed-content
```

## Nginx

```bash
sudo cp deploy/ecs/nginx/beiyu-api.conf /etc/nginx/sites-available/beiyu-api.conf
sudo ln -sf /etc/nginx/sites-available/beiyu-api.conf /etc/nginx/sites-enabled/beiyu-api.conf
sudo nginx -t
sudo systemctl reload nginx
```

无域名时 Demo API 地址：

```text
http://120.26.28.208/api/v1
```

有域名并配置 HTTPS 后：

```text
https://api.your-domain.com/api/v1
```

## 健康检查

```bash
curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready
curl http://120.26.28.208/health/ready
```

## 前端配置

Expo / iOS Demo 需要使用服务器地址：

```bash
EXPO_PUBLIC_API_BASE_URL=http://120.26.28.208/api/v1
```

正式 iOS 包建议使用 HTTPS 域名，避免 iOS ATS 限制和明文传输风险。

## 回滚

```bash
cd /opt/beiyu
git log --oneline -5
git checkout <previous-good-commit>
docker compose --env-file .env -f deploy/ecs/compose.yml up -d --build
curl http://127.0.0.1:8000/health/ready
```

数据库迁移由容器启动脚本自动执行。涉及破坏性迁移前必须先备份：

```bash
docker compose --env-file .env -f deploy/ecs/compose.yml exec db \
  pg_dump -U "$BEIYU_COMPOSE_POSTGRES_USER" "$BEIYU_COMPOSE_POSTGRES_DB" > beiyu-backup.sql
```

## 上线阻断项

- 真实短信 provider 未实现，公网 Demo 仍使用固定验证码。
- 未接域名与 HTTPS 时不建议给外部长期使用。
- 图片上传仍需对象存储和审核链路。
- 社区举报、审核 API 已补齐；仍缺运营人员可直接使用的审核后台 UI。
