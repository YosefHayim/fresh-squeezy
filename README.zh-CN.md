<!-- 由 README.md 翻译而来；英文版为权威来源。 -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src="public/fresh-squeezy-hero.png" alt="fresh-squeezy —— 面向你的 Lemon Squeezy 配置的「验证优先」体检工具。在上线前捕获计费与 webhook 配置错误。" width="640" />
  </a>
</p>

<p align="center">
  <strong>你的 Lemon Squeezy 配置体检工具 —— 在上线前捕获计费与 webhook 配置错误。</strong>
</p>

<!-- Badges. tests count is static; bump it on major test-suite changes. -->
<p align="center">
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/v/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/dm/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm downloads per month" /></a>
  <a href="https://github.com/YosefHayim/fresh-squeezy/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/YosefHayim/fresh-squeezy/ci.yml?branch=main&amp;logo=github&amp;label=CI" alt="CI status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/fresh-squeezy?color=3fb950" alt="MIT license" /></a>
  <img src="https://img.shields.io/node/v/fresh-squeezy?logo=node.js&amp;logoColor=white&amp;color=339933" alt="Node.js 20 or newer" />
  <img src="https://img.shields.io/npm/types/fresh-squeezy?logo=typescript&amp;logoColor=white" alt="TypeScript types included" />
  <a href="https://packagephobia.com/result?p=fresh-squeezy"><img src="https://packagephobia.com/badge?p=fresh-squeezy" alt="install size" /></a>
  <img src="https://img.shields.io/badge/tests-154%20passing-3fb950?logo=vitest&amp;logoColor=white" alt="154 tests passing" />
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.pt-BR.md">Português</a>
</p>

> 翻译可能落后于最新版本，以 [English README](./README.md) 为准。

<p align="center">
  <a href="#30-秒上手">快速上手</a> ·
  <a href="#它能捕获哪些-postman-和官方-sdk-发现不了的问题">它能捕获什么</a> ·
  <a href="#fresh-squeezy-与替代方案对比">对比</a> ·
  <a href="#cli">CLI</a> ·
  <a href="#库">库</a> ·
  <a href="#问题代码">问题代码</a> ·
  <a href="#faq">FAQ</a>
</p>

---

**fresh-squeezy** 是一个 CLI 和 TypeScript 库，用于验证你的 [Lemon Squeezy](https://www.lemonsqueezy.com/) 计费集成 —— 店铺、产品、webhook、折扣、许可证密钥和订阅计划 —— 并在上线前捕获配置错误。你可以将它作为一条命令的 `doctor` 在本地或 CI 中运行：它会返回稳定的[退出码](#30-秒上手)和机器可读的 JSON，并跟踪官方 SDK 尚未实现的 [Lemon Squeezy API 更新日志](https://docs.lemonsqueezy.com/api/getting-started/changelog)漂移。需要 Node 20+。

## 30 秒上手

```bash
npx fresh-squeezy
```

首次运行时，如果 `fresh-squeezy` 不在 devDependencies 中，会自动添加，然后启动引导式配置。无需从控制台复制店铺 ID —— CLI 会自行发现可访问的店铺。使用 `npx fresh-squeezy --no-install` 可在不修改 `package.json` 的情况下运行配置。

| 退出码 | 含义 |
|------|---------|
| `0`  | 所有验证器均通过 |
| `1`  | 一个或多个验证器报告了 `error` 级别的问题 |
| `2`  | 致命错误（缺少密钥、标志无效、网络故障） |
| `130` | 用户取消了交互流程 |

## 它能捕获哪些 Postman 和官方 SDK 发现不了的问题

- **生产密钥指向了测试环境。** 当密钥真实的 `meta.test_mode`（API 更新日志 2024-01-05）与声明的模式不一致时，会触发 `MODE_MISMATCH`。Doctor 以 1 退出。SDK 和手写封装默认都无法捕获这一点。
- **店铺归属静默不匹配。** 产品、折扣、许可证密钥和订阅计划的 `store_id` 与你为本次运行指定的店铺不匹配。稳定代码：`PRODUCT_WRONG_STORE`、`DISCOUNT_STORE_MISMATCH`、`LICENSE_KEY_STORE_MISMATCH`、`PLAN_STORE_MISMATCH`。
- **Webhook 订阅了错误的事件。** 与推荐事件清单（订单/订阅生命周期、退款）以及 SDK 尚未实现的较新但可选的事件进行差异比对。
- **平台漂移。** 每周运行的 GitHub Action 会将 [Lemon Squeezy API 更新日志](https://docs.lemonsqueezy.com/api/getting-started/changelog)与 `src/support/changelog-snapshot.json` 进行哈希比对，刷新由文档派生的 API 类型，并在需要做出策略决策时开启后续工作。已跟踪的新增项包括 `customer_updated`（2026-02-25）、Subscription 上的 `payment_processor`（2025-06-11）、Affiliates + `affiliate_activated`（2025-01-21）、订单项 `quantity`（2024-12-06）、结账样式 / `skip_trial` / `variant_quantities`、订阅发票退款字段，以及 `/v1/users/me` 上的 `test_mode`（2024-01-05）。
- **Postman + 控制台来回折腾。** 一次 `doctor` 调用即可替代从界面复制 ID、粘贴到环境文件、再逐个手动核验的循环。

## fresh-squeezy 与替代方案对比

下面比较了一次典型的 Lemon Squeezy 上线前检查在开发者本来会选用的各类工具上的表现：

| 能力 | fresh-squeezy | 官方 SDK | Postman | 手写封装 |
|---|:---:|:---:|:---:|:---:|
| 模式 / 密钥不匹配检测（`MODE_MISMATCH`） | ✅ | ❌ | ❌ | ❌ |
| 店铺归属交叉核验 | ✅ | ❌ | ❌ | ⚠️ 手动 |
| Webhook 事件覆盖差异比对 | ✅ | ❌ | ⚠️ 手动 | ⚠️ 手动 |
| 折扣 / 许可证密钥 / 计划验证 | ✅ | ❌ | ❌ | ⚠️ 手动 |
| 更新日志漂移跟踪 | ✅ | ❌ | ❌ | ❌ |
| 稳定的、可用于 CI 的退出码 + JSON | ✅ | ❌ | ❌ | ⚠️ 手动 |
| 一条命令完成全面扫描（`doctor`） | ✅ | ❌ | ❌ | ❌ |
| 带类型的 API 响应 | ✅ | ✅ | ❌ | ⚠️ 视情况 |

fresh-squeezy **不是**官方 SDK 的替代品 —— 它是你*配合* SDK 一起运行的预检工具。用 SDK 来发起 API 调用；用 fresh-squeezy 在这些调用进入生产环境之前证明你的配置是正确的。

## CLI

```bash
# First run: install as a dev dependency, then start guided setup
npx fresh-squeezy

# Guided setup only: reuse env values, pick a store, choose resource checks
npx fresh-squeezy init

# TTY: multi-select stores interactively, run doctor on each
npx fresh-squeezy doctor

# Full sweep across every reachable store and resource
npx fresh-squeezy doctor --all-stores --all-resources

# Machine-readable full sweep for CI
npx fresh-squeezy doctor --all-stores --all-resources --json

# Single validator, scoped to specific stores
npx fresh-squeezy validate webhook \
  --store-ids 12,34 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy
```

对于每个以店铺为作用域的命令，店铺按以下顺序解析：显式的 `--store-ids`，然后是 `--all-stores`，然后是在 TTY 上的交互式多选，最后是在没有 TTY 且没有标志时仅做连接的运行（可作为 CI 冒烟检查）。`doctor` 会验证连接、店铺访问权限以及任何显式的资源标志；加上 `--all-resources` 可在所选店铺中发现并验证每一种受支持的资源。

**→ 完整的命令、标志和店铺解析参考：[docs/cli-reference.md](./docs/cli-reference.md)**

## 库

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const lemon = createFreshSqueezy(); // reads LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_MODE

const report = await lemon.doctor({
  storeId: 12,                      // library is single-store per call
  productId: 987,
  webhookUrl: "https://app.example.com/api/webhooks/lemon-squeezy",
});

if (!report.ok) {
  for (const result of report.results) {
    for (const issue of result.issues) {
      console.error(`[${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }
  process.exit(1);
}
```

如需在库层进行多店铺运行，请在循环中调用 `doctor()` —— CLI 正是这样做的。在 CI 逻辑中对 `issue.code` 进行分支判断；这些代码在次版本之间保持稳定。

公共类型：[`FreshSqueezyClient`](src/createFreshSqueezy.ts)、[`ValidationResult<T>`](src/core/types.ts)、[`DoctorReport`](src/core/types.ts)、[`src/resources`](src/resources) 下的资源属性接口、[`src/generated/lemonSqueezyApiTypes.ts`](src/generated/lemonSqueezyApiTypes.ts) 中由文档生成的 Lemon Squeezy 对象类型，以及 [`src/augmentations.ts`](src/augmentations.ts) 中的更新日志增强辅助函数。

对于尚未封装的端点，可使用原始转义出口：

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

## 沙盒模式 vs 正式模式

Lemon Squeezy 从同一个 API 主机提供两种模式；模式由密钥决定。`fresh-squeezy` 会将声明的模式与来自 `/v1/users/me` 的 `meta.test_mode` 进行交叉核验。不匹配 = `MODE_MISMATCH`，doctor 以 1 退出 —— 这是在生产密钥指向测试环境造成损害之前捕获它的最快方式。

```ts
const lemon = createFreshSqueezy({ mode: "test" });
const result = await lemon.validateConnection();
result.mode;                 // "test" (declared)
result.resource?.actualMode; // "live" — alarm bell
```

CLI 默认是 `--mode test`。使用 `--mode live` 覆盖。在检测到正式模式密钥时，引导式配置会在继续之前要求明确确认。对于 CI 中的每夜平台漂移检查，请在设置 `LEMON_SQUEEZY_LIVE_SMOKE=1` 并使用测试模式密钥的情况下运行 `pnpm test:live`。

## 环境变量

| 变量 | 是否必填 | 用途 |
|----------|----------|---------|
| `LEMON_SQUEEZY_API_KEY` | 是 | Bearer 令牌（库 + CLI） |
| `LEMON_SQUEEZY_MODE` | 否 | `test`（默认）或 `live` |
| `LEMON_SQUEEZY_STORE_ID` | 否 | 供 `client.doctor()` 使用的便捷默认值 —— 仅限库 |

CLI 不会读取 `LEMON_SQUEEZY_STORE_ID`；请使用 `--store-ids` 或 `--all-stores`，以便每条命令的店铺选择都保持显式。

## 问题代码

在 CI 中对 `issue.code` 进行分支判断 —— 所有代码在次版本之间保持稳定。最常见的几个：

| 代码 | 含义 |
|------|---------|
| `AUTH_FAILED` | API 密钥无效或缺失 |
| `MODE_MISMATCH` | 声明的模式与密钥的 `meta.test_mode` 不一致 |
| `STORE_NOT_FOUND` / `STORE_NOT_OWNED` | 店铺 ID 无效或归属于其他账户 |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | 产品无法接受结账 |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING` | Webhook URL 未注册或订阅不足 |

**→ 完整的问题代码参考（折扣、许可证密钥、计划、变体、网络）及转义出口示例：[docs/issue-codes.md](./docs/issue-codes.md)**

## 参考

验证器 —— 每个都返回一个稳定的 `ValidationResult`：

- **`validateConnection`** —— 可达性、密钥有效性、店铺存在性、声明模式与实际模式。[→ 源码](src/validate/connection.ts)
- **`validateStore`** —— 店铺 ID 存在且归属于密钥所在的账户。[→ 源码](src/validate/store.ts)
- **`validateProduct`** —— 已发布、位于预期店铺、拥有正式变体和购买 URL。[→ 源码](src/validate/product.ts)
- **`validateWebhook`** —— Webhook URL 已注册并订阅了推荐事件。[→ 源码](src/validate/webhook.ts)
- **`validateDiscount`** —— 有效、在时间窗口内、金额有效、店铺归属匹配。[→ 源码](src/validate/discount.ts)
- **`validateLicenseKey`** —— 已启用、未过期、有可用的激活次数、店铺归属匹配。[→ 源码](src/validate/licenseKey.ts)
- **`validateSubscriptionPlan`** —— 订阅类型、有效的周期、非零价格、一致的试用期。[→ 源码](src/validate/subscriptionPlan.ts)
- **`doctor`** —— 将上述各项组合成一份 `DoctorReport`。[→ 源码](src/validate/doctor.ts)

资源覆盖范围是从 Lemon Squeezy 的对象文档生成的，因此大多数新文档化的字段不需要手动编辑：

```bash
pnpm generate:api-types
pnpm check:api-types
```

## FAQ

### 我如何检查我的 Lemon Squeezy webhook 是否订阅了正确的事件？

运行 `npx fresh-squeezy validate webhook --store-ids <id> --webhook-url <url>`。fresh-squeezy 会将你的 webhook 已订阅的事件与推荐的订单/订阅/退款事件清单进行差异比对，对缺口报告 `WEBHOOK_EVENTS_MISSING`，如果该 URL 根本未注册则报告 `WEBHOOK_NOT_FOUND`。

### 我如何捕获指向测试（暂存）店铺的 Lemon Squeezy 生产密钥？

那就是 `MODE_MISMATCH` 检查。fresh-squeezy 会将你声明的模式（`--mode` 或 `LEMON_SQUEEZY_MODE`）与来自 `/v1/users/me` 的密钥真实 `meta.test_mode` 进行比较。当二者不一致时，`doctor` 以 1 退出 —— 这样在暂存部署中意外使用的正式密钥（或反之）就会在到达用户之前未通过检查。

### fresh-squeezy 在 CI 中能用吗？

可以。运行 `npx fresh-squeezy doctor --all-stores --all-resources --json` 进行机器可读的全面扫描。它会返回稳定的[退出码](#30-秒上手)（`0` 通过、`1` 验证错误、`2` 致命错误）以及你可以断言的稳定 `issue.code` 字符串。无需 TTY —— 在没有店铺标志时它会回退到仅做连接的冒烟检查。

### fresh-squeezy 是官方 Lemon Squeezy SDK 的替代品吗？

不是。[官方 SDK](https://github.com/lmsqueezy/lemonsqueezy.js) 负责发起 API 调用；fresh-squeezy 是预检工具，在这些调用进入生产环境*之前*证明你的配置是正确的。二者互补 —— 参见[对比表](#fresh-squeezy-与替代方案对比)。

### 什么是「更新日志漂移」，我为什么要关心？

Lemon Squeezy 发布 API 变更（新事件、新字段、新资源）的速度快于客户端 SDK 采纳它们的速度。fresh-squeezy 通过每周运行的 GitHub Action，将[官方更新日志](https://docs.lemonsqueezy.com/api/getting-started/changelog)与一份已提交的快照进行跟踪，因此新推荐的 webhook 事件或响应字段会作为可执行的工作浮现出来，而不是被静默地不加验证。

### 我可以把 fresh-squeezy 当作库而不是 CLI 来用吗？

可以。`import { createFreshSqueezy } from "fresh-squeezy"`，然后调用 `doctor()` 或任何单个验证器。每个验证器都返回一个带类型的、稳定的 `ValidationResult`，供你进行分支判断 —— 参见[库](#库)。

### 它能验证哪些 Lemon Squeezy 资源？

连接/认证、店铺、产品（及变体）、webhook、折扣、许可证密钥和订阅计划。加上 `--all-resources` 可在所选店铺中发现并验证每一种受支持的资源。完整列表见[参考](#参考)。

## 贡献

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。克隆仓库，运行 `pnpm install`、`pnpm test`。本项目力求保持小巧而朴素 —— 验证优先、单一 HTTP 层、稳定的 `issue.code` 契约。

## 贡献者

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## 许可证

MIT —— 参见 [LICENSE](./LICENSE)。
