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

## Fix Round 1/5

### 审查修复

- 为 Provider 增加统一会话清理路径：内存 access token 立即失效，SecureStore refresh token 尽力清理且不遮蔽原始认证错误，随后仅在组件仍挂载时落为 `signedOut`。
- 将 SecureStore 初始读取纳入恢复错误处理，读取异常不再留下未处理 rejection 或永久 `restoring`。
- 为 Task 3 认证客户端的二次 401 回调注册 Provider 会话失效处理；它会更新 Provider 状态而不引入对 client 的循环依赖。
- 为登录页短信、登录/bootstrap 完成回调和倒计时增加 mounted guard；真实卸载后 resolve/reject 不会再更新组件状态或继续导航。

### RED 证据

先新增 Provider 回归用例，覆盖 SecureStore 读取拒绝、登录后本地同步初始化失败的双令牌回滚，以及认证客户端会话失效回调；并扩展登录页测试，在同一次真实卸载后 resolve 短信请求、reject 登录初始化。

运行：

```text
npm test -- --runInBand src/state/__tests__/AuthState.test.tsx src/components/mixology/__tests__/LoginScreen.test.tsx src/components/mixology/__tests__/WelcomeScreen.test.tsx src/components/mixology/__tests__/SettingsScreen.test.tsx
```

RED 结果：SecureStore 读取异常停在 `restoring` 并抛出；登录初始化失败未调用 `setAccessToken(null)` 或清理 SecureStore；认证失效回调未切换 `signedOut`。登录页测试以真实卸载后的完成路径验证所有异步状态更新均受保护。

### GREEN 与验证

```text
Focused tests: 4 suites passed, 26 tests passed
npm test -- --runInBand: 64 suites passed, 217 tests passed
npm run lint: passed
npm run typecheck: passed
git diff --check: passed
```

### 修复提交

`0cdfa3c148196977f6e93bd50f5bbae5ea3ecd83` (`fix: harden mobile auth session recovery`)

## Fix Round 2/5

### 补强内容

- 增加登录后 bootstrap 失败且 SecureStore 清理也失败的行为测试：对外仍抛出同一个初始化错误、Provider 保持 `signedOut`、内存 token 已清除，且清理拒绝不会形成未处理错误。
- 登录页卸载测试现在先让短信请求成功并显示 `retryAfter` 倒计时，再真实卸载、推进 fake timer、完成登录 Promise；验证既不产生卸载后状态更新警告，也不会触发 `router.replace` 或 `router.push`。
- 警告捕获遍历每个 console 调用的全部参数，并在每个测试结束后恢复 spies 和真实 timers。

### RED 与 GREEN

先添加上述行为测试。初版卸载测试使用 `rerender(<></>)`，在当前测试渲染器中不能可靠代表卸载，因而错误地观察到导航；改为在 `act` 中执行真实 `unmount()` 后，既覆盖实际生命周期，也确认现有 mounted guard 已满足要求。本轮未发现需要保留的生产代码改动。

```text
Focused tests: 4 suites passed, 27 tests passed
npm run lint: passed
npm run typecheck: passed
git diff --check: passed
```

### 修复提交

`935f149e7f5a0168ee12e9f80696f32b156c5870` (`test: cover auth cleanup and login unmount`)
