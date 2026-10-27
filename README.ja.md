<!-- README.md の翻訳です。英語版が正本です。 -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src="public/fresh-squeezy-hero.png" alt="fresh-squeezy — 最新の Lemon Squeezy クライアントと、課金設定をチェックする doctor。" width="640" />
  </a>
</p>

<p align="center">
  <strong>最新の Lemon Squeezy 用 TypeScript クライアントと、課金設定のミスを本番前に見つける doctor。</strong>
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
  <a href="./README.zh-CN.md">简体中文</a> ·
  <b>日本語</b> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.pt-BR.md">Português</a>
</p>

<p align="center">
  <a href="#インストール">インストール</a> ·
  <a href="#クライアント">クライアント</a> ·
  <a href="#doctor">Doctor</a> ·
  <a href="#置き換え-lemonsqueezylemonsqueezyjs">公式 SDK の置き換え</a> ·
  <a href="#03-からのアップグレード">0.3 からのアップグレード</a> ·
  <a href="#型を最新に保つ">型を最新に保つ</a> ·
  <a href="#finding-コード">Finding コード</a>
</p>

---

**fresh-squeezy** は [Lemon Squeezy](https://www.lemonsqueezy.com/) 向けの 2 つの道具です。

1. **型付きクライアント**。[`@lemonsqueezy/lemonsqueezy.js`](https://github.com/lmsqueezy/lemonsqueezy.js) を置き換えます。公式 SDK の最後のリリースは 2024-11-05 の 4.0.0 です。fresh-squeezy は [API の変更履歴](https://docs.lemonsqueezy.com/api/getting-started/changelog)に追従します。ランタイム依存はゼロ、ESM と CJS に対応します。
2. **doctor**。公開前にストアをチェックします。接続とモード、ストア、商品、サブスクリプションプラン、webhook、割引、ライセンスキーが対象です。安定した finding コード、安定した終了コード、CI 向けの JSON を返します。

Node 22 以上。

## インストール

```bash
pnpm add fresh-squeezy
```

キーは一度だけ設定します。モードの既定値は `test` です。

```bash
LEMON_SQUEEZY_API_KEY=your-key
LEMON_SQUEEZY_MODE=test
LEMON_SQUEEZY_STORE_ID=12
```

`LEMON_SQUEEZY_STORE_ID` は任意です。同じ名前を `createFreshSqueezy({ apiKey, mode, storeId, baseUrl })` のオプションとしても使えます。

## クライアント

リソース名で型が決まります。属性名は API が返すとおり snake_case です。

```ts
import { createFreshSqueezy } from "fresh-squeezy";

const freshSqueezy = createFreshSqueezy();

const subscription = await freshSqueezy.get("subscriptions", "123");
const paidOrders = await freshSqueezy.list("orders", { store_id: 1, status: "paid" });

await freshSqueezy.create("checkouts", {
	attributes: { checkout_data: { email: "ada@example.com" } },
	relationships: { store: "1", variant: "2" },
});
await freshSqueezy.update("subscriptions", "123", { pause: { mode: "void" } });
await freshSqueezy.remove("webhooks", "9");
await freshSqueezy.cancelSubscription("123");
await freshSqueezy.refund("orders", "55", 500);
await freshSqueezy.generateInvoice("orders", "55", { name, address, city, state, zip_code, country });
await freshSqueezy.currentUsage("77");
```

- `list` はすべてのページを読み込みます。フィルターは `filter[...]` クエリパラメーターになります。
- 呼び出しが失敗すると `FreshSqueezyError`(`code`、`status`、`detail` を持つ通常の `Error`)を投げます。`fresh-squeezy/errors` の `isFreshSqueezyError` で判定し、`.code` で分岐します。
- クライアントには [Lemon Squeezy API ドキュメント](https://docs.lemonsqueezy.com/api)に載っている呼び出しだけがあります。商品、バリアント、価格には書き込み API がないため、書き込みもありません。

ライセンス API は API キー不要で、専用のサブパスにあります。

```ts
import { activateLicense, validateLicense, deactivateLicense } from "fresh-squeezy/license";

await activateLicense({ licenseKey, instanceName });
await validateLicense({ licenseKey, instanceId }); // instanceId は任意
await deactivateLicense({ licenseKey, instanceId });
```

## Doctor

```bash
# キーで到達できるすべてのストア
npx fresh-squeezy doctor

# 1 つのストアと、その中のすべての商品、プラン、webhook、割引、ライセンスキー
npx fresh-squeezy doctor --store-id 12 --all-resources

# 2 つのストア、1 つの webhook URL、機械可読な出力
npx fresh-squeezy doctor --store-id 12 --store-id 34 \
  --webhook-url https://app.example.com/api/webhooks/lemon-squeezy --json
```

| フラグ | 意味 |
| --- | --- |
| `--mode <test\|live>` | チェックするモード。既定値: `LEMON_SQUEEZY_MODE`、なければ `test` |
| `--store-id <id>` | チェックするストア。複数指定は繰り返します。既定値: `LEMON_SQUEEZY_STORE_ID`、なければすべてのストア |
| `--all-resources` | 各ストア内のすべての商品、プラン、webhook、割引、ライセンスキーもチェックする |
| `--product-id <id>` | チェックする商品。複数指定は繰り返します |
| `--variant-id <id>` | チェックするサブスクリプションプラン。複数指定は繰り返します |
| `--webhook-url <url>` | チェックする webhook。複数指定は繰り返します |
| `--discount-id <id>` | チェックする割引。複数指定は繰り返します |
| `--license-key-id <id>` | チェックするライセンスキー。複数指定は繰り返します |
| `--json` | レポートを JSON で出力する |
| `--help`, `--version` | ヘルプまたはバージョンを表示する |

doctor は `LEMON_SQUEEZY_API_KEY` を環境変数、または作業ディレクトリの `.env` ファイルから読みます。入力を求めることも、止まることもありません。

| 終了コード | 意味 |
| --- | --- |
| `0` | すべてのチェックが成功 |
| `1` | チェックが失敗 |
| `2` | フラグまたは設定の誤り(キー未設定、モード不正、フラグ不正) |

`--json` は 1 つのオブジェクトを出力します。

```json
{
  "ok": false,
  "mode": "test",
  "reports": [
    {
      "ok": false,
      "mode": "test",
      "results": [
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

`reports` にはストアごとに 1 つのレポートが入ります。`error` の finding がないチェックは `ok` です。

### CI

```yaml
- name: Check Lemon Squeezy
  run: npx fresh-squeezy doctor --all-resources --json
  env:
    LEMON_SQUEEZY_API_KEY: ${{ secrets.LEMON_SQUEEZY_API_KEY }}
    LEMON_SQUEEZY_MODE: live
```

終了コードが `1` または `2` のとき、ステップは失敗します。本番キーがテストストアを指している場合(またはその逆)は `MODE_MISMATCH` になります。doctor は宣言したモードと `/v1/users/me` の `meta.test_mode` を比べます。

### TypeScript からチェックを実行する

各チェックは `ValidationResult` を返し、例外を投げません。

```ts
const freshSqueezy = createFreshSqueezy({ mode: "live" });

const connection = await freshSqueezy.validateConnection();
const discount = await freshSqueezy.validateDiscount({ storeId: "12", discountId: "77" });
const report = await freshSqueezy.doctor({ storeId: "12", allResources: true });
const storeIds = await freshSqueezy.listStoreIds();

for (const check of report.results) {
	for (const finding of check.findings) {
		console.error(`[${finding.severity}] ${finding.code}: ${finding.message}`);
	}
}
```

チェックは `validateConnection`、`validateStore`、`validateProduct`、`validateSubscriptionPlan`、`validateWebhook`、`validateDiscount`、`validateLicenseKey` と、これらを 1 つのストアに対して実行する `doctor` です。結果と finding の型は `fresh-squeezy/findings` にあります。

## 置き換え @lemonsqueezy/lemonsqueezy.js

SDK がエクスポートするすべての関数と、それを置き換える fresh-squeezy の呼び出しです。すべての行に共通する違いは次のとおりです。

- `lemonSqueezySetup` は `createFreshSqueezy` になります。グローバル状態はありません。返されたオブジェクトを保持してください。
- SDK は `{ statusCode, data, error }` を返します。fresh-squeezy はリソースを返し、失敗時は `FreshSqueezyError` を投げます。
- 属性は camelCase(`variantId`)ではなく snake_case(`variant_id`)です。id は文字列です。
- `archiveCustomer` は `update("customers", id, { status: "archived" })` です。[顧客の更新ドキュメント](https://docs.lemonsqueezy.com/api/customers/update-customer)を参照してください。
- ライセンス関数は `fresh-squeezy/license` に移りました。

| `@lemonsqueezy/lemonsqueezy.js` | `fresh-squeezy` |
| ------------------------------- | --------------- |
| `activateLicense` | `activateLicense({ licenseKey, instanceName })` from `fresh-squeezy/license` |
| `archiveCustomer` | `update("customers", id, { status: "archived" })` |
| `cancelSubscription` | `cancelSubscription(id)` |
| `createCheckout` | `create("checkouts", { attributes, relationships: { store, variant } })` |
| `createCustomer` | `create("customers", { attributes, relationships: { store: storeId } })` |
| `createDiscount` | `create("discounts", { attributes, relationships: { store, variants } })` |
| `createUsageRecord` | `create("usage-records", { attributes, relationships: { "subscription-item": id } })` |
| `createWebhook` | `create("webhooks", { attributes, relationships: { store: storeId } })` |
| `deactivateLicense` | `deactivateLicense({ licenseKey, instanceId })` from `fresh-squeezy/license` |
| `deleteDiscount` | `remove("discounts", id)` |
| `deleteWebhook` | `remove("webhooks", id)` |
| `generateOrderInvoice` | `generateInvoice("orders", id, billing)` |
| `generateSubscriptionInvoice` | `generateInvoice("subscription-invoices", id, billing)` |
| `getAuthenticatedUser` | `get("users", "me")` |
| `getCheckout` | `get("checkouts", id)` |
| `getCustomer` | `get("customers", id)` |
| `getDiscount` | `get("discounts", id)` |
| `getDiscountRedemption` | `get("discount-redemptions", id)` |
| `getFile` | `get("files", id)` |
| `getLicenseKey` | `get("license-keys", id)` |
| `getLicenseKeyInstance` | `get("license-key-instances", id)` |
| `getOrder` | `get("orders", id)` |
| `getOrderItem` | `get("order-items", id)` |
| `getPrice` | `get("prices", id)` |
| `getProduct` | `get("products", id)` |
| `getStore` | `get("stores", id)` |
| `getSubscription` | `get("subscriptions", id)` |
| `getSubscriptionInvoice` | `get("subscription-invoices", id)` |
| `getSubscriptionItem` | `get("subscription-items", id)` |
| `getSubscriptionItemCurrentUsage` | `currentUsage(subscriptionItemId)` |
| `getUsageRecord` | `get("usage-records", id)` |
| `getVariant` | `get("variants", id)` |
| `getWebhook` | `get("webhooks", id)` |
| `issueOrderRefund` | `refund("orders", id, amount)` |
| `issueSubscriptionInvoiceRefund` | `refund("subscription-invoices", id, amount)` |
| `lemonSqueezySetup` | `createFreshSqueezy({ apiKey })` |
| `listCheckouts` | `list("checkouts", filter)` |
| `listCustomers` | `list("customers", filter)` |
| `listDiscountRedemptions` | `list("discount-redemptions", filter)` |
| `listDiscounts` | `list("discounts", filter)` |
| `listFiles` | `list("files", filter)` |
| `listLicenseKeyInstances` | `list("license-key-instances", filter)` |
| `listLicenseKeys` | `list("license-keys", filter)` |
| `listOrderItems` | `list("order-items", filter)` |
| `listOrders` | `list("orders", filter)` |
| `listPrices` | `list("prices", filter)` |
| `listProducts` | `list("products", filter)` |
| `listStores` | `list("stores", filter)` |
| `listSubscriptionInvoices` | `list("subscription-invoices", filter)` |
| `listSubscriptionItems` | `list("subscription-items", filter)` |
| `listSubscriptions` | `list("subscriptions", filter)` |
| `listUsageRecords` | `list("usage-records", filter)` |
| `listVariants` | `list("variants", filter)` |
| `listWebhooks` | `list("webhooks", filter)` |
| `updateCustomer` | `update("customers", id, attributes)` |
| `updateLicenseKey` | `update("license-keys", id, attributes)` |
| `updateSubscription` | `update("subscriptions", id, attributes)` |
| `updateSubscriptionItem` | `update("subscription-items", id, attributes)` |
| `updateWebhook` | `update("webhooks", id, attributes)` |
| `validateLicense` | `validateLicense({ licenseKey, instanceId })` from `fresh-squeezy/license` |

この 60 行が `@lemonsqueezy/lemonsqueezy.js` 4.0.0 のエクスポートするすべての関数です。

## 0.3 からのアップグレード

- ops コマンドと verb レジストリは削除されました。[クライアント](#クライアント)を使ってください。
- `init`、`manage`、`validate` サブコマンド、augmentation、ランチャーメニューは削除されました。コマンドは `fresh-squeezy doctor` だけで、フラグのみを受け付けます。
- `--store-ids a,b` は `--store-id a --store-id b` になりました。ストアを指定しない場合、doctor はすべてのストアをチェックするため、`--all-stores` が既定です。
- issue は finding になりました。`ISSUE_CODES` は `FINDING_CODES`、`issue.code` は `finding.code`、JSON のキー `issues` は `findings` です。コードは変わりませんが、`STORE_NOT_OWNED` は削除されました(どこからも発生していませんでした)。
- サブパスのエクスポートは `.`、`./config`、`./errors`、`./findings`、`./types`、`./license` になりました。
- Node 22 以上が必要です。ランタイム依存はなくなりました。

```ts
// 変更前
import { validateStore } from "fresh-squeezy/validate/store";
if (result.issues.length > 0) console.error(result.issues[0].code);

// 変更後
import { createFreshSqueezy } from "fresh-squeezy";
const freshSqueezy = createFreshSqueezy();
const result = await freshSqueezy.validateStore("12");
if (result.findings.length > 0) console.error(result.findings[0].code);
```

## 型を最新に保つ

`lemon-squeezy-changelog` ワークフローは毎月 1 日と 15 日に実行されます。[API の変更履歴](https://docs.lemonsqueezy.com/api/getting-started/changelog)の最新エントリにまだ issue がなければ、`changelog-drift` ラベル付きの issue を作ります。

直すには、エントリを読み、`src/shared/lemon-squeezy-types.ts` とクライアントを手で編集し、テストを追加して、issue を閉じます。issue をエージェントに任せることもできます。

公開リポジトリでは、60 日間アクティビティがないと GitHub がスケジュール実行を止めます。次のコマンドで再び有効にします。

```bash
gh workflow enable lemon-squeezy-changelog
```

## Finding コード

CI では `finding.code` で分岐します。コードはマイナーバージョン間で安定しています。

| コード | 意味 |
| --- | --- |
| `AUTH_FAILED` | API キーが無効または未設定 |
| `MODE_MISMATCH` | 宣言したモードがキーの `meta.test_mode` と一致しない |
| `STORE_NOT_FOUND` | このキーでストア ID が見つからない |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | 商品でチェックアウトできない |
| `PLAN_INVALID_INTERVAL` / `PLAN_FREE_PRICE` | サブスクリプションプランの期間が不正、または価格がない |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING` | webhook URL が未登録、またはイベントが不足 |
| `DISCOUNT_EXPIRED` / `DISCOUNT_REDEMPTIONS_EXHAUSTED` | 割引が使えない |
| `LICENSE_KEY_DISABLED` / `LICENSE_KEY_EXPIRED` | ライセンスキーを有効化できない |

完全な一覧は `fresh-squeezy/findings` の `FINDING_CODES` にあります。

## コントリビュート

必要なもの: Node.js 22 以上と pnpm 10。

```bash
git clone https://github.com/YosefHayim/fresh-squeezy.git
cd fresh-squeezy
pnpm install
pnpm verify
```

目標と非目標は [PROJECT.md](./PROJECT.md)、コマンド・ルール・手順は [AGENTS.md](./AGENTS.md)、コードの構造は [CONTEXT.md](./CONTEXT.md) を読んでください。

issue を立てるときは、`fresh-squeezy` のバージョン、Node のバージョン、モード、最小の再現手順、キーを除いた doctor の `--json` 出力を含めてください。

## コントリビューター

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## ライセンス

MIT — [LICENSE](./LICENSE) を参照。
