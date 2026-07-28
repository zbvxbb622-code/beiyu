# 经典系列模块说明（当前状态）

> 适用范围：`src/app/recipes.tsx`（"经典系列"页面 /recipes）。本文件记录该页面**当前**的结构与改动，作为后续维护依据。

## 一、页面结构（现状）

1. **搜索框**：placeholder 为「搜索酒款、风味...」，覆盖酒款名 / 风味检索。
2. **每日推荐大图（Hero）**：`RecipeEditorialHero`，由 `src/services/classicService.ts` 的 `getDailyClassicFeature(date)` 以本地日期为种子做稳定哈希，从「全部经典酒款」池中选取 1 款，**当天稳定、隔天轮换**。展示日期标签（如 `7月26日`），点击进入 `/recipe/[id]`。
3. **经典酒款列表**：`SectionHeader`（左侧品牌色竖条 + 主/副标题）引导，下方为酒款卡片列表（FlatList，响应式列数：小屏单列 / 中屏双列 / 大屏三列）。

> 注：`ClassicBar` / `ClassicFeature` / 经典酒吧分区 / 名吧详情路由 `/classic-bar/[id]` 等均已在 Request A 中**整体删除**（见第三节）。

## 二、间距规范（Request A 调整）

| 位置 | 当前值 | 说明 |
|---|---|---|
| 搜索框 → Hero | 沿用既有呼吸感 | 搜索与推荐之间保留间距 |
| Hero → 「经典酒款」标题 | `heroWrap.marginBottom: 0` + `SectionHeader.marginTop: 0` | **大图与分区标题之间无间距**，紧贴呈现 |
| 经典酒款卡片之间 | 分隔线 `height:1` + `marginVertical:10` | 卡片之间增加明确留白，提升层次感与可读性 |

## 三、已删除内容（Request A）

- 数据：`src/data/classicBars.ts`（已删）
- 类型：`src/types/mixology.ts` 中的 `ClassicBar`、`ClassicFeature`（已删）
- 服务：`src/services/classicService.ts` 仅保留 `getDailyClassicFeature`，移除 `getClassicBars` / `getClassicBarById`，每日推荐**恒为鸡尾酒**
- 组件：`ClassicBarEditorialHero.tsx`、`ClassicBarEditorialRow.tsx`（已删）
- 页面：`src/app/classic-bar/[id].tsx`（已删，路由返回 404）
- 测试：上述组件 / 路由对应测试文件（已删）

## 四、酒款图片（Request B 替换）

- 23 款鸡尾酒原本多复用非酒款图（酒吧内景/霓虹/设计稿），已替换为**与酒名匹配的 CC 授权清晰酒款照片**。
- 来源：Wikimedia Commons（主）+ Openverse/Flickr（兜底，`bellini` 走此路）。下载用 `curl` + Chrome UA 绕过 403，429 限流用重试 + 原图兜底；`daiquiri` 经 `sips -Z 1280` 降体积。
- 新增 17 个 `require` 键到 `src/data/imageAssets.ts`（`cocktailMoscowMule` … `cocktailFrench75`，`oldFashioned` 已存在）；`src/data/recipes.ts` 中 18 个 `imageKey` 重映射至匹配图。
- 组件用 `resizeMode:"cover"` + 固定尺寸裁切，**任意源比例不变形、不溢出**。23 个 `cocktail-*.jpg` 均通过 JPEG 校验。

## 五、验证

- `tsc --noEmit` ✅ 通过
- `npx jest` ✅ 33 套 / 78 条全过
- `/recipes` Expo Web 预览 HTTP 200；`/classic-bar` 返回 404（确认删除）
- 23 个 `imageKey` 全部可在 `imageAssets` 解析，无缺失键
