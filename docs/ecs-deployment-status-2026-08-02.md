# ECS Demo 部署记录

日期：2026-08-02

## 部署版本

- 分支：`codex/stage3-ai-acceptance`
- 提交：`6c9c31a8bb90a8e9a27a78946c2a70c54d8c70ae`
- 服务器：`120.26.28.208`
- API：`http://120.26.28.208/api/v1`

## 已部署内容

- 社区帖子/评论举报 API。
- 社区管理员举报列表 API。
- 社区帖子/评论审核 API。
- 社区审核审计日志 API。
- 社区审核数据库迁移 `20260802_0008`。
- 前端 EAS 打包配置文件已进入代码库。

## 服务器验证

- API 容器已重启。
- 启动日志确认执行迁移：
  - `20260802_0007 -> 20260802_0008`
- 数据库当前 revision：
  - `20260802_0008`
- 数据库表存在：
  - `community_reports`
  - `community_audit_logs`
- 健康检查：
  - `http://127.0.0.1:8000/health/live`：通过
  - `http://127.0.0.1:8000/health/ready`：通过
  - `http://120.26.28.208/health/ready`：通过

## 远端 Smoke

已用一次性测试数据验证：

- 登录测试账号。
- 创建社区帖子。
- 创建评论。
- 举报帖子。
- 举报评论。
- 管理员查看举报列表。
- 管理员隐藏帖子。
- 普通用户访问隐藏帖子返回 `404`。
- 管理员恢复帖子。
- 审计日志包含 `report_post`、`report_comment`、`hide_post`、`approve_post`。
- 测试帖子已删除。

## 回滚

服务器旧源码目录已保留为 `/opt/beiyu.prev-*`。

回滚思路：

```bash
cd /opt
mv beiyu beiyu.bad-$(date -u +%Y%m%d%H%M%S)
mv beiyu.prev-<timestamp> beiyu
cd /opt/beiyu
docker compose --env-file .env -f deploy/ecs/compose.yml -f deploy/ecs/compose.image.yml up -d --force-recreate api
curl http://127.0.0.1:8000/health/ready
```

注意：本次迁移新增表和字段，普通回滚代码不会自动降级数据库。需要数据库降级时必须先备份，再执行 Alembic downgrade。

## 仍不是正式商用上线

- 当前仍是 HTTP IP Demo，缺正式域名和 HTTPS。
- 真实短信 Provider 仍未接入。
- 生产图片上传仍未接对象存储和审核。
- 社区审核后台 UI 仍未实现。
- 仍缺生产监控、告警、备份和合规备案材料。
