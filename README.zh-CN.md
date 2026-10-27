<!-- 译自 README.md;以英文版为准。 -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src=".github/fresh-squeezy-hero.png" alt="fresh-squeezy — 最新的 Lemon Squeezy 客户端,外加检查计费配置的 doctor。" width="640" />
  </a>
</p>

<p align="center">
  <strong>面向 TypeScript 的最新 Lemon Squeezy 客户端,外加在上线前发现计费配置错误的 doctor。</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/v/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/fresh-squeezy"><img src="https://img.shields.io/npm/dm/fresh-squeezy?logo=npm&amp;color=cb3837" alt="npm downloads per month" /></a>
  <a href="https://github.com/YosefHayim/fresh-squeezy/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/YosefHayim/fresh-squeezy/ci.yml?branch=main&amp;logo=github&amp;label=CI" alt="CI status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/fresh-squeezy?color=3fb950" alt="MIT license" /></a>
  <img src="https://img.shields.io/node/v/fresh-squeezy?logo=node.js&amp;logoColor=white&amp;color=339933" alt="Node.js 22 or newer" />
  <img src="https://img.shields.io/npm/types/fresh-squeezy?logo=typescript&amp;logoColor=white" alt="TypeScript types included" />
  <a href="https://packagephobia.com/result?p=fresh-squeezy"><img src="https://packagephobia.com/badge?p=fresh-squeezy" alt="install size" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.pt-BR.md">Português</a>
</p>

<p align="center">
  <a href="#安装">安装</a> ·
  <a href="#客户端">客户端</a> ·
  <a href="#doctor">Doctor</a> ·
  <a href="#替换-lemonsqueezylemonsqueezyjs">替换官方 SDK</a> ·
  <a href="#从-03-升级">从 0.3 升级</a> ·
  <a href="#保持类型最新">保持类型最新</a> ·
  <a href="#finding-代码">Finding 代码</a>
</p>

---

**fresh-squeezy** 取代已不再维护的 Lemon Squeezy SDK，让每个应用无需自己写类型和测试，就能获得有类型、经过检查的计费。它为 [Lemon Squeezy](https://www.lemonsqueezy.com/) 提供两样东西:

1. **一个带类型的客户端**,用来替换 [`@lemonsqueezy/lemonsqueezy.js`](https://github.com/lmsqueezy/lemonsqueezy.js)。官方 SDK 最后一次发布是 2024-11-05 的 4.0.0;fresh-squeezy 跟随 [API 更新日志](https://docs.lemonsqueezy.com/api/getting-started/changelog)。零运行时依赖,支持 ESM 和 CJS。
2. **一个 doctor**,在上线前检查店铺:连接与模式、店铺、产品、订阅方案、webhook、折扣和许可证密钥。它给出稳定的 finding 代码、稳定的退出码,以及适合 CI 的 JSON。

Node 22 或更高版本。

## 安装

```bash
pnpm add fresh-squeezy
```

每种模式设置一个 API 密钥。`LEMON_SQUEEZY_MODE` 决定使用哪个密钥,默认为 `test`。

```bash
LEMON_SQUEEZY_TEST_API_KEY=your-test-key
LEMON_SQUEEZY_LIVE_API_KEY=your-live-key
LEMON_SQUEEZY_MODE=test
LEMON_SQUEEZY_STORE_ID=12
```

只需设置所运行模式的密钥,`LEMON_SQUEEZY_STORE_ID` 是可选的。同样的设置也可作为 `createFreshSqueezy({ apiKey, mode, storeId, baseUrl })` 的选项。

## 客户端

资源名称决定类型。属性名使用 snake_case,与 API 返回的一致。

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const freshSqueezy = createFreshSqueezy();

const subscription = await freshSqueezy.get("subscriptions", "123");
const paidOrders = await freshSqueezy.list("orders", {
	store_id: 1,
	status: "paid",
});

await freshSqueezy.create("checkouts", {
	attributes: { checkout_data: { email: "ada@example.com" } },
	relationships: { store: "1", variant: "2" },
});
await freshSqueezy.update("subscriptions", "123", { pause: { mode: "void" } });
await freshSqueezy.remove("webhooks", "9");
await freshSqueezy.cancelSubscription("123");
await freshSqueezy.refund("orders", "55", 500);
await freshSqueezy.generateInvoice("orders", "55", {
	name,
	address,
	city,
	state,
	zip_code,
	country,
});
await freshSqueezy.currentUsage("77");
```

- `list` 会读取所有分页。过滤条件会变成 `filter[...]` 查询参数。
- 调用失败会抛出 `FreshSqueezyError`(一个带有 `code`、`status` 和 `detail` 的普通 `Error`)。用 `fresh-squeezy/errors` 中的 `isFreshSqueezyError` 检查,并根据 `.code` 分支处理。
- 客户端只包含 [Lemon Squeezy API 文档](https://docs.lemonsqueezy.com/api)列出的调用。产品、变体和价格没有写入 API,所以这里也没有写入方法。

许可证 API 不需要 API 密钥,放在单独的子路径中:

```ts
import {
	activateLicense,
	validateLicense,
	deactivateLicense,
} from "fresh-squeezy/license";

await activateLicense({ licenseKey, instanceName });
await validateLicense({ licenseKey, instanceId }); // instanceId 可选
await deactivateLicense({ licenseKey, instanceId });
```

每次调用都会返回 API 的响应，4xx 时也一样：检查 `activated`、`valid` 或 `deactivated`，以及 `error`。只有在网络失败或响应不是 JSON 时才会抛出 `FreshSqueezyError`。

## Doctor

```bash
# 密钥可访问的所有店铺
npx fresh-squeezy doctor

# 一个店铺,加上其中所有产品、方案、webhook、折扣和许可证密钥
npx fresh-squeezy doctor --store-id 12 --all-resources

# 两个店铺,一个 webhook URL,机器可读输出
npx fresh-squeezy doctor --store-id 12 --store-id 34 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy --json
```

| 参数                    | 含义                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `--mode <test\|live>`   | 要检查的模式。默认:`LEMON_SQUEEZY_MODE`,否则 `test`             |
| `--store-id <id>`       | 要检查的店铺,可重复。默认:`LEMON_SQUEEZY_STORE_ID`,否则所有店铺 |
| `--all-resources`       | 同时检查每个店铺中的所有产品、方案、webhook、折扣和许可证密钥   |
| `--product-id <id>`     | 要检查的产品,可重复                                             |
| `--variant-id <id>`     | 要检查的订阅方案,可重复                                         |
| `--webhook-url <url>`   | 要检查的 webhook,可重复                                         |
| `--discount-id <id>`    | 要检查的折扣,可重复                                             |
| `--license-key-id <id>` | 要检查的许可证密钥,可重复                                       |
| `--json`                | 以 JSON 输出报告                                                |
| `--help`, `--version`   | 显示帮助或版本                                                  |

doctor 从环境变量或工作目录中的 `.env` 文件读取其模式的密钥 (`LEMON_SQUEEZY_TEST_API_KEY` 或 `LEMON_SQUEEZY_LIVE_API_KEY`)。它从不提问,也不会卡住。

| 退出码 | 含义                                         |
| ------ | -------------------------------------------- |
| `0`    | 所有检查通过                                 |
| `1`    | 有检查失败                                   |
| `2`    | 参数或配置错误(缺少密钥、模式错误、参数错误) |

`--json` 输出一个对象:

```json
{
	"ok": false,
	"mode": "test",
	"reports": [
		{
			"ok": false,
			"mode": "test",
			"checks": [
				{
					"name": "discount",
					"ok": false,
					"mode": "test",
					"target": { "label": "discount", "id": "77" },
					"findings": [
						{
							"code": "DISCOUNT_EXPIRED",
							"severity": "error",
							"message": "...",
							"suggestedFix": "..."
						}
					]
				}
			]
		}
	]
}
```

`reports` 中每个店铺对应一份报告。没有 `error` 级 finding 的检查为 `ok`。

### CI

```yaml
- name: Check Lemon Squeezy
  run: npx fresh-squeezy doctor --all-resources --json
  env:
    LEMON_SQUEEZY_LIVE_API_KEY: ${{ secrets.LEMON_SQUEEZY_LIVE_API_KEY }}
    LEMON_SQUEEZY_MODE: live
```

退出码为 `1` 或 `2` 时该步骤失败。线上密钥指向测试店铺(或相反)会触发 `MODE_MISMATCH`:doctor 会把声明的模式与 `/v1/users/me` 返回的 `meta.test_mode` 比较。

### 在 TypeScript 中运行检查

每个检查都返回 `CheckReport`,且从不抛出异常。

```ts
const freshSqueezy = createFreshSqueezy({ mode: "live" });

const connection = await freshSqueezy.validateConnection();
const discount = await freshSqueezy.validateDiscount({
	storeId: "12",
	discountId: "77",
});
const report = await freshSqueezy.doctor({ storeId: "12", allResources: true });
const storeIds = await freshSqueezy.listStoreIds();

for (const check of report.checks) {
	for (const finding of check.findings) {
		console.error(`[${finding.severity}] ${finding.code}: ${finding.message}`);
	}
}
```

检查包括:`validateConnection`、`validateStore`、`validateProduct`、`validateSubscriptionPlan`、`validateWebhook`、`validateDiscount`、`validateLicenseKey`,以及对一个店铺运行以上全部检查的 `doctor`。结果和 finding 的类型来自 `fresh-squeezy/findings`。

## 替换 @lemonsqueezy/lemonsqueezy.js

SDK 导出的每个函数,以及替换它的 fresh-squeezy 调用。以下差异适用于所有行:

- `lemonSqueezySetup` 变为 `createFreshSqueezy`。没有全局状态:请保留它返回的对象。
- SDK 返回 `{ statusCode, data, error }`。fresh-squeezy 返回资源,失败时抛出 `FreshSqueezyError`。
- 属性使用 snake_case(`variant_id`),而不是 camelCase(`variantId`)。id 是字符串。
- `archiveCustomer` 对应 `update("customers", id, { status: "archived" })`,见[更新客户文档](https://docs.lemonsqueezy.com/api/customers/update-customer)。
- 许可证函数移到 `fresh-squeezy/license`。

| `@lemonsqueezy/lemonsqueezy.js`   | `fresh-squeezy`                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `activateLicense`                 | `activateLicense({ licenseKey, instanceName })` from `fresh-squeezy/license`          |
| `archiveCustomer`                 | `update("customers", id, { status: "archived" })`                                     |
| `cancelSubscription`              | `cancelSubscription(id)`                                                              |
| `createCheckout`                  | `create("checkouts", { attributes, relationships: { store, variant } })`              |
| `createCustomer`                  | `create("customers", { attributes, relationships: { store: storeId } })`              |
| `createDiscount`                  | `create("discounts", { attributes, relationships: { store, variants } })`             |
| `createUsageRecord`               | `create("usage-records", { attributes, relationships: { "subscription-item": id } })` |
| `createWebhook`                   | `create("webhooks", { attributes, relationships: { store: storeId } })`               |
| `deactivateLicense`               | `deactivateLicense({ licenseKey, instanceId })` from `fresh-squeezy/license`          |
| `deleteDiscount`                  | `remove("discounts", id)`                                                             |
| `deleteWebhook`                   | `remove("webhooks", id)`                                                              |
| `generateOrderInvoice`            | `generateInvoice("orders", id, billing)`                                              |
| `generateSubscriptionInvoice`     | `generateInvoice("subscription-invoices", id, billing)`                               |
| `getAuthenticatedUser`            | `get("users", "me")`                                                                  |
| `getCheckout`                     | `get("checkouts", id)`                                                                |
| `getCustomer`                     | `get("customers", id)`                                                                |
| `getDiscount`                     | `get("discounts", id)`                                                                |
| `getDiscountRedemption`           | `get("discount-redemptions", id)`                                                     |
| `getFile`                         | `get("files", id)`                                                                    |
| `getLicenseKey`                   | `get("license-keys", id)`                                                             |
| `getLicenseKeyInstance`           | `get("license-key-instances", id)`                                                    |
| `getOrder`                        | `get("orders", id)`                                                                   |
| `getOrderItem`                    | `get("order-items", id)`                                                              |
| `getPrice`                        | `get("prices", id)`                                                                   |
| `getProduct`                      | `get("products", id)`                                                                 |
| `getStore`                        | `get("stores", id)`                                                                   |
| `getSubscription`                 | `get("subscriptions", id)`                                                            |
| `getSubscriptionInvoice`          | `get("subscription-invoices", id)`                                                    |
| `getSubscriptionItem`             | `get("subscription-items", id)`                                                       |
| `getSubscriptionItemCurrentUsage` | `currentUsage(subscriptionItemId)`                                                    |
| `getUsageRecord`                  | `get("usage-records", id)`                                                            |
| `getVariant`                      | `get("variants", id)`                                                                 |
| `getWebhook`                      | `get("webhooks", id)`                                                                 |
| `issueOrderRefund`                | `refund("orders", id, amount)`                                                        |
| `issueSubscriptionInvoiceRefund`  | `refund("subscription-invoices", id, amount)`                                         |
| `lemonSqueezySetup`               | `createFreshSqueezy({ apiKey })`                                                      |
| `listCheckouts`                   | `list("checkouts", filter)`                                                           |
| `listCustomers`                   | `list("customers", filter)`                                                           |
| `listDiscountRedemptions`         | `list("discount-redemptions", filter)`                                                |
| `listDiscounts`                   | `list("discounts", filter)`                                                           |
| `listFiles`                       | `list("files", filter)`                                                               |
| `listLicenseKeyInstances`         | `list("license-key-instances", filter)`                                               |
| `listLicenseKeys`                 | `list("license-keys", filter)`                                                        |
| `listOrderItems`                  | `list("order-items", filter)`                                                         |
| `listOrders`                      | `list("orders", filter)`                                                              |
| `listPrices`                      | `list("prices", filter)`                                                              |
| `listProducts`                    | `list("products", filter)`                                                            |
| `listStores`                      | `list("stores", filter)`                                                              |
| `listSubscriptionInvoices`        | `list("subscription-invoices", filter)`                                               |
| `listSubscriptionItems`           | `list("subscription-items", filter)`                                                  |
| `listSubscriptions`               | `list("subscriptions", filter)`                                                       |
| `listUsageRecords`                | `list("usage-records", filter)`                                                       |
| `listVariants`                    | `list("variants", filter)`                                                            |
| `listWebhooks`                    | `list("webhooks", filter)`                                                            |
| `updateCustomer`                  | `update("customers", id, attributes)`                                                 |
| `updateLicenseKey`                | `update("license-keys", id, attributes)`                                              |
| `updateSubscription`              | `update("subscriptions", id, attributes)`                                             |
| `updateSubscriptionItem`          | `update("subscription-items", id, attributes)`                                        |
| `updateWebhook`                   | `update("webhooks", id, attributes)`                                                  |
| `validateLicense`                 | `validateLicense({ licenseKey, instanceId })` from `fresh-squeezy/license`            |

这 60 行就是 `@lemonsqueezy/lemonsqueezy.js` 4.0.0 导出的全部函数。

## 从 0.3 升级

- 结果改名为检查:`ValidationResult` 改为 `CheckReport`，`ValidationTarget` 改为 `CheckTarget`，`DoctorOptions` 改为 `DoctorTargets`，`buildResult` 改为 `buildCheckReport`，`DoctorReport` 的键 `results` 改为 `checks`。
- `ENV_KEYS` 已移除。环境变量是 `LEMON_SQUEEZY_TEST_API_KEY`、`LEMON_SQUEEZY_LIVE_API_KEY`、`LEMON_SQUEEZY_MODE` 和 `LEMON_SQUEEZY_STORE_ID`。
- ops 命令和动词注册表已移除。请使用[客户端](#客户端)。
- `init`、`manage`、`validate` 子命令、augmentation 和启动菜单已移除。唯一的命令是 `fresh-squeezy doctor`,只接受参数。
- `--store-ids a,b` 改为 `--store-id a --store-id b`。未指定店铺时 doctor 检查所有店铺,所以 `--all-stores` 是默认行为。
- issue 改称 finding:`ISSUE_CODES` 变为 `FINDING_CODES`,`issue.code` 变为 `finding.code`,JSON 键 `issues` 变为 `findings`。代码本身不变,但 `STORE_NOT_OWNED` 已移除(没有任何地方触发它)。
- 子路径导出现在是 `.`、`./config`、`./errors`、`./findings`、`./types` 和 `./license`。
- 需要 Node 22 或更高版本。运行时依赖已全部移除。

```ts
// 之前
import { validateStore } from "fresh-squeezy/validate/store";
if (report.issues.length > 0) console.error(report.issues[0].code);

// 之后
import { createFreshSqueezy } from "fresh-squeezy";
const freshSqueezy = createFreshSqueezy();
const storeReport = await freshSqueezy.validateStore("12");
if (storeReport.findings.length > 0)
	console.error(storeReport.findings[0].code);
```

## 保持类型最新

`lemon-squeezy-changelog` 工作流在每月 1 日和 15 日运行。当 [API 更新日志](https://docs.lemonsqueezy.com/api/getting-started/changelog)的最新条目还没有对应 issue 时,它会创建一个带 `changelog-drift` 标签的 issue。

修复方法:阅读该条目,然后手动编辑 `src/client/lemon-squeezy-types.ts` 和客户端,添加测试,并关闭 issue。也可以交给 agent 处理。

`live-api-check` workflow 也在每月 1 日和 15 日运行。它把测试密钥能读取的每个 Lemon Squeezy 资源与类型对比，当 API 返回类型中没有的字段时，打开一个带 `live-api-drift` 标签的 issue。

在公开仓库中,仓库 60 天没有活动后,GitHub 会停用定时工作流。用下面的命令重新启用:

```bash
gh workflow enable lemon-squeezy-changelog
gh workflow enable live-api-check
```

## Finding 代码

在 CI 中根据 `finding.code` 分支处理。代码在次要版本之间保持稳定。

| 代码                                                                 | 含义                                       |
| -------------------------------------------------------------------- | ------------------------------------------ |
| `AUTH_FAILED`                                                        | API 密钥无效或缺失                         |
| `MODE_MISMATCH`                                                      | 声明的模式与密钥的 `meta.test_mode` 不一致 |
| `STORE_NOT_FOUND`                                                    | 此密钥下找不到该店铺 ID                    |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | 产品无法结账                               |
| `PLAN_INVALID_INTERVAL` / `PLAN_FREE_PRICE`                          | 订阅方案的周期有误或没有价格               |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING`                       | webhook URL 未注册或缺少订单事件           |
| `DISCOUNT_EXPIRED` / `DISCOUNT_REDEMPTIONS_EXHAUSTED`                | 折扣无法使用                               |
| `LICENSE_KEY_DISABLED` / `LICENSE_KEY_EXPIRED`                       | 许可证密钥无法激活                         |

完整列表见 `fresh-squeezy/findings` 中的 `FINDING_CODES`。

## 参与贡献

要求:Node.js 22+ 和 pnpm 10。

```bash
git clone https://github.com/YosefHayim/fresh-squeezy.git
cd fresh-squeezy
pnpm install
pnpm check
```

客户端在 `src/client/`，检查在 `src/doctor/`。`pnpm check` 运行与 CI 相同的 lint、typecheck、测试和构建。

提交 issue 时,请附上 `fresh-squeezy` 版本、Node 版本、模式、最小复现,以及去掉密钥的 doctor `--json` 输出。

## 贡献者

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## 许可证

MIT — 见 [LICENSE](./LICENSE)。
