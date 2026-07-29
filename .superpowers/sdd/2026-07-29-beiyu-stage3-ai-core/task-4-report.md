# Task 4 实现报告

## 改动文件

- `src/state/AuthState.tsx`
- `src/state/__tests__/AuthState.test.tsx`
- `src/app/_layout.tsx`
- `src/app/login.tsx`
- `src/app/settings.tsx`
- `src/components/mixology/WelcomeScreen.tsx`
- `src/components/mixology/__tests__/LoginScreen.test.tsx`
- `src/components/mixology/__tests__/WelcomeScreen.test.tsx`
- `src/components/mixology/__tests__/SettingsScreen.test.tsx`

## 实现结果

- 新增 `AuthProvider` 与 `useAuth()`；认证状态严格为 `restoring`、`signedOut`、`signedIn`。访问令牌只存在运行内存，刷新令牌继续由 Task 2 的 SecureStore token store 管理。
- App 启动恢复覆盖无 token、刷新成功、刷新失败清理、bootstrap，以及恢复期间卸载不更新 React 状态。
- 新用户登录会先上传本地年龄、资料、隐私与酒柜同步数据，再读取 bootstrap；老用户只读取 bootstrap。退出登录经真实 repository 清除会话。
- 根 Provider 顺序为 `ContentProvider > AuthProvider > MixologyProvider`。恢复时显示现有深色加载界面；未登录可浏览公共内置内容，`/ai` 会转到登录页。
- 登录页已改为受控手机号和 6 位验证码表单，含协议确认、短信重发倒计时、重复提交锁、可见失败提示，并且只在 `login`/`bootstrap` 成功后导航。
- 欢迎页年龄确认保存本地标记后前往 `/login`，已移除“游客可跳过”表述。

## RED 证据

先添加 Provider、登录和欢迎页测试，并运行：

```text
npm test -- --runInBand src/state/__tests__/AuthState.test.tsx src/components/mixology/__tests__/LoginScreen.test.tsx src/components/mixology/__tests__/WelcomeScreen.test.tsx
```

初始结果为失败：`@/state/AuthState` 尚不存在；欢迎页仍渲染“游客可跳过”。随后修正 Jest mock 夹具，确保失败指向缺失功能而非测试配置。

## GREEN 与验证

```text
npm test -- --runInBand src/state/__tests__/AuthState.test.tsx src/components/mixology/__tests__/LoginScreen.test.tsx src/components/mixology/__tests__/WelcomeScreen.test.tsx src/components/mixology/__tests__/SettingsScreen.test.tsx
4 suites passed, 22 tests passed

npm test -- --runInBand
64 suites passed, 213 tests passed

npm run lint
passed

npm run typecheck
passed
```

`git diff --check` 也通过；新增代码未记录 token 或响应 body 日志。

## 提交

实现提交：`5374c06181fc9356985bcec307b1681eb409eeeb` (`feat: connect Expo to real authentication`)

## 遗留风险

- 未执行连接真实后端和实体设备 SecureStore 的端到端验证；自动化测试覆盖 repository 合同、Provider 生命周期和页面交互。
