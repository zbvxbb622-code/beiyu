# 杯语未实现与轻实现功能清单

更新时间：2026-08-02

## 已在本轮补齐

- 社区帖子和评论增加 `moderation_status`。
- 新增社区举报表 `community_reports`。
- 新增社区审核审计表 `community_audit_logs`。
- 新增用户举报帖子、举报评论 API。
- 新增管理员查看举报、审核帖子、审核评论、查看审计日志 API。
- 普通社区列表和详情默认过滤隐藏/拒绝内容。
- 前端帖子详情页增加帖子举报和评论举报入口。
- 前端 AuthRepository 增加举报帖子、举报评论方法。
- 新增 `eas.json`，包含 development、preview、production 三套 EAS Build 配置骨架。

## 仍未实现

1. **社区审核后台 Web 页面**
   - 当前只有管理员 API，没有可视化后台页面。
   - 老板 Demo 可以通过 API 演示审核闭环，但运营人员还不能在网页后台处理举报。

2. **生产级图片上传**
   - 当前社区图片支持内置图和本机图片 URI 演示。
   - 上线必须接 OSS/S3/R2、CDN、图片压缩、图片审核、公开 URL 或签名 URL。

3. **真实实名认证**
   - 当前是身份证格式和年龄校验。
   - 上线前需要接公安或合规第三方实名服务，并补数据最小化、失败复核、脱敏存储。

4. **短信服务**
   - Demo 可使用内部验证码链路。
   - 生产需要接短信供应商、频控、黑名单、失败告警和费用监控。

5. **审核策略和风控规则**
   - 当前有举报、隐藏、恢复、拒绝的基础状态。
   - 缺敏感词、图片审核、用户封禁、重复举报限制、批量处理和内容申诉。

6. **App Store 正式提交材料**
   - 当前有 `eas.json` 骨架。
   - 仍缺 Apple Team、证书、描述文件、App Store Connect App ID、隐私标签、截图、审核说明。

7. **生产域名和 HTTPS**
   - 当前 preview API 指向 `http://120.26.28.208/api/v1`。
   - production 仍是占位 `https://api.beiyu.example.com/api/v1`，上线前必须替换为真实备案域名并配置 HTTPS。

8. **监控、告警和备份**
   - 缺 Sentry 或同类错误监控。
   - 缺 API uptime、数据库备份、日志留存、告警联系人。

## 轻实现或 Demo 实现

1. **社区审核后台**
   - 后端能力已可用，但没有运营后台 UI。

2. **相册图片**
   - 可在本机 Demo 显示。
   - 换设备或生产环境不能依赖 `file://` 本地路径。

3. **官方认证**
   - 当前展示为“暂未开放”。
   - 没有真实资质提交、审核和认证标识。

4. **微信绑定、密码设置、客服帮助**
   - 当前统一降级为“暂未开放”或静态说明。
   - 没有接真实微信 OAuth、密码体系、客服工单。

5. **经典盲盒**
   - 当前更适合 Demo 展示。
   - 抽卡规则、库存、抽取记录、分享归因还没有完整后端化。

6. **每日酒单**
   - 前端已有模块化展示和每日轮换逻辑。
   - 内容主要依赖本地数据，不是运营后台动态发布。

7. **酒吧与酒品内容**
   - 可展示 Demo 数据。
   - 缺商家入驻、运营维护、内容审核、地理位置实时服务。

8. **AI 合规**
   - AI 聊天可接真实模型。
   - 仍缺正式上线所需的生成式 AI 服务备案、提示词/输出审计策略、用户协议中的 AI 说明。

## 依赖审计结论

- `npm audit --audit-level=moderate` 当前报告 11 个 moderate。
- 漏洞主要来自 Expo 依赖链中的间接包。
- `npm audit fix --package-lock-only --dry-run` 没有给出安全自动修复动作。
- `npm audit` 建议的修复涉及 Expo 主版本/版本链变更，不建议在当前 Demo 收口任务中强制执行。
- 建议单独开任务升级 Expo/React Native 版本链，升级后必须重新跑 iOS Simulator、Expo export、Jest、lint、typecheck。

## 打包配置状态

- 已新增 `eas.json`。
- `development`：开发客户端，iOS simulator。
- `preview`：内部测试包，API 指向当前 ECS `http://120.26.28.208/api/v1`。
- `production`：生产通道，占位 HTTPS 域名。
- 正式打包前必须替换：
  - `build.production.env.EXPO_PUBLIC_API_BASE_URL`
  - `submit.production.ios.ascAppId`
  - Apple 开发者账号、证书、描述文件和 App Store Connect 配置。
