<!-- Traduzido de README.md; a versão em inglês é a fonte da verdade. -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src="assets/fresh-squeezy-hero.png" alt="fresh-squeezy — o doctor validator-first para a sua configuração do Lemon Squeezy. Detecte erros de configuração de cobrança e webhooks antes de subir para produção." width="640" />
  </a>
</p>

<p align="center">
  <strong>O doctor para a sua configuração do Lemon Squeezy — detecte erros de configuração de cobrança e webhooks antes de subir para produção.</strong>
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
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <b>Português</b>
</p>

> As traduções podem estar desatualizadas. A versão canônica é o [README em inglês](./README.md).

<p align="center">
  <a href="#início-rápido-em-30-segundos">Início rápido</a> ·
  <a href="#o-que-ele-detecta-que-o-postman-e-o-sdk-oficial-não-detectam">O que ele detecta</a> ·
  <a href="#fresh-squeezy-vs-as-alternativas">Comparação</a> ·
  <a href="#cli">CLI</a> ·
  <a href="#biblioteca">Biblioteca</a> ·
  <a href="#códigos-de-problema">Códigos de problema</a> ·
  <a href="#faq">FAQ</a>
</p>

---

O **fresh-squeezy** é uma CLI e uma biblioteca TypeScript que valida a sua integração de cobrança do [Lemon Squeezy](https://www.lemonsqueezy.com/) — lojas, produtos, webhooks, descontos, chaves de licença e planos de assinatura — e detecta erros de configuração antes de subir para produção. Execute-o como um `doctor` de um único comando localmente ou em CI: ele retorna [códigos de saída](#início-rápido-em-30-segundos) estáveis e JSON legível por máquina, e acompanha o drift do [changelog da API do Lemon Squeezy](https://docs.lemonsqueezy.com/api/getting-started/changelog) que o SDK oficial ainda não incorporou. Node 20+.

## Início rápido em 30 segundos

```bash
npx fresh-squeezy
```

A primeira execução adiciona `fresh-squeezy` às devDependencies quando ele está ausente e, em seguida, inicia a configuração guiada. Nenhum ID de loja para copiar do dashboard — a CLI descobre por conta própria as lojas acessíveis. Use `npx fresh-squeezy --no-install` para executar a configuração sem editar o `package.json`.

| Saída | Significado |
|------|---------|
| `0`  | Todos os validadores passaram |
| `1`  | Um ou mais validadores reportaram problemas de nível `error` |
| `2`  | Fatal (chave ausente, flags inválidas, falha de rede) |
| `130` | O usuário cancelou um fluxo interativo |

## O que ele detecta que o Postman e o SDK oficial não detectam

- **Chave de produção apontando para staging.** `MODE_MISMATCH` dispara quando o `meta.test_mode` real da chave (changelog da API 2024-01-05) diverge do modo declarado. O doctor sai com 1. Nem o SDK nem um wrapper feito à mão detectam isso por padrão.
- **Divergências silenciosas de propriedade de loja.** Produtos, descontos, chaves de licença e planos de assinatura cujo `store_id` não corresponde à loja para a qual você limitou a execução. Códigos estáveis: `PRODUCT_WRONG_STORE`, `DISCOUNT_STORE_MISMATCH`, `LICENSE_KEY_STORE_MISMATCH`, `PLAN_STORE_MISMATCH`.
- **Webhook inscrito nos eventos errados.** Diff em relação a um manifesto de eventos recomendados (ciclo de vida de pedidos/assinaturas, reembolsos) e eventos mais novos, porém opcionais, que o SDK não incorpora.
- **Drift da plataforma.** Uma GitHub Action semanal calcula o hash do [changelog da API do Lemon Squeezy](https://docs.lemonsqueezy.com/api/getting-started/changelog) em relação ao `src/support/changelog-snapshot.json`, atualiza os tipos de API derivados da documentação e abre trabalho de acompanhamento quando decisões de política são necessárias. As adições rastreadas incluem `customer_updated` (2026-02-25), `payment_processor` em Subscription (2025-06-11), Afiliados + `affiliate_activated` (2025-01-21), `quantity` em item de pedido (2024-12-06), estilização de checkout / `skip_trial` / `variant_quantities`, campos de reembolso de fatura de assinatura e `test_mode` em `/v1/users/me` (2024-01-05).
- **Ping-pong entre Postman e dashboard.** Uma única chamada `doctor` substitui o loop de copiar IDs da interface, colá-los em arquivos de env e verificar cada um manualmente.

## fresh-squeezy vs as alternativas

Como uma verificação típica pré-deploy do Lemon Squeezy se compara entre as ferramentas que um desenvolvedor recorreria de outra forma:

| Recurso | fresh-squeezy | SDK oficial | Postman | Wrapper feito à mão |
|---|:---:|:---:|:---:|:---:|
| Detecção de divergência de modo / chave (`MODE_MISMATCH`) | ✅ | ❌ | ❌ | ❌ |
| Verificações cruzadas de propriedade de loja | ✅ | ❌ | ❌ | ⚠️ manual |
| Diff de cobertura de eventos de webhook | ✅ | ❌ | ⚠️ manual | ⚠️ manual |
| Validação de desconto / chave de licença / plano | ✅ | ❌ | ❌ | ⚠️ manual |
| Rastreamento de drift do changelog | ✅ | ❌ | ❌ | ❌ |
| Códigos de saída estáveis e prontos para CI + JSON | ✅ | ❌ | ❌ | ⚠️ manual |
| Varredura completa em um único comando (`doctor`) | ✅ | ❌ | ❌ | ❌ |
| Respostas de API tipadas | ✅ | ✅ | ❌ | ⚠️ depende |

O fresh-squeezy **não** é um substituto para o SDK oficial — é a verificação pré-voo que você executa *junto* dele. Use o SDK para fazer chamadas de API; use o fresh-squeezy para comprovar que a sua configuração está correta antes que essas chamadas cheguem à produção.

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

As lojas são resolvidas nesta ordem para todo comando com escopo de loja: `--store-ids` explícito, depois `--all-stores`, depois uma seleção múltipla interativa em um TTY e, por fim, uma execução somente de conexão quando não há TTY nem flag (útil como smoke check de CI). O `doctor` valida a conexão e o acesso à loja, além de quaisquer flags de recurso explícitas; adicione `--all-resources` para descobrir e validar todos os recursos suportados na(s) loja(s) selecionada(s).

**→ Referência completa de comandos, flags e resolução de lojas: [docs/cli-reference.md](./docs/cli-reference.md)**

## Biblioteca

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

Para execuções multi-loja na camada de biblioteca, chame `doctor()` em um loop — a CLI faz exatamente isso. Faça o branch com base em `issue.code` na lógica de CI; os códigos são estáveis entre versões menores.

Tipos públicos: [`FreshSqueezyClient`](src/createFreshSqueezy.ts), [`ValidationResult<T>`](src/core/types.ts), [`DoctorReport`](src/core/types.ts), interfaces de atributos de recurso em [`src/resources`](src/resources), tipos de objeto do Lemon Squeezy gerados a partir da documentação em [`src/generated/lemonSqueezyApiTypes.ts`](src/generated/lemonSqueezyApiTypes.ts) e helpers de augmentação do changelog em [`src/augmentations.ts`](src/augmentations.ts).

Para endpoints ainda não encapsulados, use a saída de emergência bruta:

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

## Sandbox vs live

O Lemon Squeezy atende os dois modos a partir do mesmo host de API; o modo é determinado pela chave. O `fresh-squeezy` faz a verificação cruzada do modo declarado contra o `meta.test_mode` de `/v1/users/me`. Divergência = `MODE_MISMATCH`, o doctor sai com 1 — a forma mais rápida de detectar uma chave de produção apontando para staging antes que ela cause danos.

```ts
const lemon = createFreshSqueezy({ mode: "test" });
const result = await lemon.validateConnection();
result.mode;                 // "test" (declared)
result.resource?.actualMode; // "live" — alarm bell
```

O padrão da CLI é `--mode test`. Sobrescreva com `--mode live`. A configuração guiada pede confirmação explícita antes de continuar com uma chave em modo live detectada. Para verificações noturnas de drift da plataforma em CI, execute `npm run test:live` com `LEMON_SQUEEZY_LIVE_SMOKE=1` e uma chave em modo de teste.

## Variáveis de ambiente

| Variável | Obrigatória | Finalidade |
|----------|----------|---------|
| `LEMON_SQUEEZY_API_KEY` | sim | Bearer token (biblioteca + CLI) |
| `LEMON_SQUEEZY_MODE` | não | `test` (padrão) ou `live` |
| `LEMON_SQUEEZY_STORE_ID` | não | Padrão de conveniência para `client.doctor()` — somente biblioteca |

A CLI não lê `LEMON_SQUEEZY_STORE_ID`; use `--store-ids` ou `--all-stores` para que a seleção de loja permaneça explícita em cada comando.

## Códigos de problema

Faça o branch com base em `issue.code` na CI — todos os códigos são estáveis entre versões menores. Os mais comuns:

| Código | Significado |
|------|---------|
| `AUTH_FAILED` | Chave de API inválida ou ausente |
| `MODE_MISMATCH` | O modo declarado não corresponde ao `meta.test_mode` da chave |
| `STORE_NOT_FOUND` / `STORE_NOT_OWNED` | ID de loja inválido ou pertencente a outra conta |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | O produto não pode aceitar checkout |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING` | URL do webhook não registrada ou com inscrição insuficiente |

**→ Referência completa de códigos de problema (descontos, chaves de licença, planos, variantes, rede) com exemplos de saída de emergência: [docs/issue-codes.md](./docs/issue-codes.md)**

## Referência

Validadores — cada um retorna um `ValidationResult` estável:

- **`validateConnection`** — acessibilidade, validade da chave, presença da loja, modo declarado vs. real. [→ código-fonte](src/validate/connection.ts)
- **`validateStore`** — o ID da loja existe e pertence à conta da chave. [→ código-fonte](src/validate/store.ts)
- **`validateProduct`** — publicado, na loja esperada, com variantes live e uma URL de compra. [→ código-fonte](src/validate/product.ts)
- **`validateWebhook`** — URL do webhook registrada e inscrita nos eventos recomendados. [→ código-fonte](src/validate/webhook.ts)
- **`validateDiscount`** — ativo, dentro da janela, valor válido, propriedade de loja correspondente. [→ código-fonte](src/validate/discount.ts)
- **`validateLicenseKey`** — habilitada, não expirada, ativações disponíveis, propriedade de loja correspondente. [→ código-fonte](src/validate/licenseKey.ts)
- **`validateSubscriptionPlan`** — tipo de assinatura, intervalo válido, preço não nulo, trial consistente. [→ código-fonte](src/validate/subscriptionPlan.ts)
- **`doctor`** — compõe os anteriores em um único `DoctorReport`. [→ código-fonte](src/validate/doctor.ts)

A cobertura de recursos é gerada a partir da documentação de objetos do Lemon Squeezy, então a maioria dos campos recém-documentados não precisa de edição manual:

```bash
npm run generate:api-types
npm run check:api-types
```

## FAQ

### Como verifico se o meu webhook do Lemon Squeezy está inscrito nos eventos certos?

Execute `npx fresh-squeezy validate webhook --store-ids <id> --webhook-url <url>`. O fresh-squeezy compara os eventos inscritos do seu webhook com um manifesto de eventos recomendados de pedido/assinatura/reembolso e reporta `WEBHOOK_EVENTS_MISSING` para as lacunas, ou `WEBHOOK_NOT_FOUND` se a URL não estiver registrada de forma alguma.

### Como detecto uma chave de produção do Lemon Squeezy apontando para uma loja de teste (staging)?

Essa é a verificação `MODE_MISMATCH`. O fresh-squeezy compara o modo que você declarou (`--mode` ou `LEMON_SQUEEZY_MODE`) com o `meta.test_mode` real da chave de `/v1/users/me`. Quando eles divergem, o `doctor` sai com 1 — então uma chave live usada acidentalmente em um deploy de staging (ou vice-versa) falha na verificação antes de chegar aos usuários.

### O fresh-squeezy funciona em CI?

Sim. Execute `npx fresh-squeezy doctor --all-stores --all-resources --json` para uma varredura completa legível por máquina. Ele retorna [códigos de saída](#início-rápido-em-30-segundos) estáveis (`0` passou, `1` erros de validação, `2` fatal) e strings `issue.code` estáveis nas quais você pode fazer asserções. Não requer TTY — sem flags de loja, ele recorre a um smoke check apenas de conexão.

### O fresh-squeezy é um substituto para o SDK oficial do Lemon Squeezy?

Não. O [SDK oficial](https://github.com/lmsqueezy/lemonsqueezy.js) faz chamadas de API; o fresh-squeezy é a verificação pré-voo que comprova que a sua configuração está correta *antes* que essas chamadas cheguem à produção. Eles são complementares — veja a [tabela de comparação](#fresh-squeezy-vs-as-alternativas).

### O que é "drift do changelog" e por que devo me importar?

O Lemon Squeezy lança mudanças de API (novos eventos, novos campos, novos recursos) mais rápido do que os SDKs clientes as adotam. O fresh-squeezy rastreia o [changelog oficial](https://docs.lemonsqueezy.com/api/getting-started/changelog) em relação a um snapshot versionado por meio de uma GitHub Action semanal, de modo que eventos de webhook ou campos de resposta recém-recomendados apareçam como trabalho acionável em vez de ficarem silenciosamente sem validação.

### Posso usar o fresh-squeezy como biblioteca em vez da CLI?

Sim. `import { createFreshSqueezy } from "fresh-squeezy"` e chame `doctor()` ou qualquer validador individual. Todo validador retorna um `ValidationResult` tipado e estável no qual você pode fazer o branch — veja [Biblioteca](#biblioteca).

### Quais recursos do Lemon Squeezy ele consegue validar?

Conexão/autenticação, lojas, produtos (e variantes), webhooks, descontos, chaves de licença e planos de assinatura. Adicione `--all-resources` para descobrir e validar todos os recursos suportados na(s) loja(s) selecionada(s). Lista completa na [referência](#referência).

## Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md). Clone, `npm install`, `npm test`. O projeto busca permanecer pequeno e sem firulas — validator-first, uma única camada HTTP, contrato `issue.code` estável.

## Contribuidores

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## Licença

MIT — veja [LICENSE](./LICENSE).
