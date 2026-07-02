<!-- Traducido de README.md; la versión en inglés es la fuente de verdad. -->

<p align="center">
  <a href="https://github.com/YosefHayim/fresh-squeezy">
    <img src="public/fresh-squeezy-hero.png" alt="fresh-squeezy — el doctor con enfoque en validación para tu configuración de Lemon Squeezy. Detecta errores de configuración de facturación y webhooks antes de que lleguen a producción." width="640" />
  </a>
</p>

<p align="center">
  <strong>El doctor para tu configuración de Lemon Squeezy — detecta errores de configuración de facturación y webhooks antes de que lleguen a producción.</strong>
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
  <b>Español</b> ·
  <a href="./README.pt-BR.md">Português</a>
</p>

> Las traducciones pueden estar desactualizadas. La versión canónica es el [README en inglés](./README.md).

<p align="center">
  <a href="#inicio-en-30-segundos">Inicio rápido</a> ·
  <a href="#lo-que-detecta-y-que-postman-y-el-sdk-oficial-no-detectan">Lo que detecta</a> ·
  <a href="#fresh-squeezy-frente-a-las-alternativas">Comparación</a> ·
  <a href="#cli">CLI</a> ·
  <a href="#biblioteca">Biblioteca</a> ·
  <a href="#códigos-de-incidencia">Códigos de incidencia</a> ·
  <a href="#faq">FAQ</a>
</p>

---

**fresh-squeezy** es una CLI y una biblioteca de TypeScript que valida tu integración de facturación de [Lemon Squeezy](https://www.lemonsqueezy.com/) — tiendas, productos, webhooks, descuentos, claves de licencia y planes de suscripción — y detecta errores de configuración antes de que lleguen a producción. Ejecútala como un único comando `doctor` localmente o en CI: devuelve [códigos de salida](#inicio-en-30-segundos) estables y JSON legible por máquina, y rastrea las desviaciones del [registro de cambios de la API de Lemon Squeezy](https://docs.lemonsqueezy.com/api/getting-started/changelog) que el SDK oficial aún no ha incorporado. Node 20+.

## Inicio en 30 segundos

```bash
npx fresh-squeezy
```

La primera ejecución agrega `fresh-squeezy` a las devDependencies cuando no está presente, y luego inicia la configuración guiada. No hay que copiar un ID de tienda desde el panel — la CLI descubre por sí misma las tiendas accesibles. Usa `npx fresh-squeezy --no-install` para ejecutar la configuración sin modificar `package.json`.

| Salida | Significado |
|------|---------|
| `0`  | Todos los validadores pasaron |
| `1`  | Uno o más validadores reportaron incidencias de nivel `error` |
| `2`  | Fatal (clave faltante, flags inválidos, fallo de red) |
| `130` | El usuario canceló un flujo interactivo |

## Lo que detecta y que Postman y el SDK oficial no detectan

- **Clave de producción apuntando a staging.** `MODE_MISMATCH` se dispara cuando el verdadero `meta.test_mode` de la clave (registro de cambios de la API 2024-01-05) no coincide con el modo declarado. Doctor sale con 1. Ni el SDK ni un wrapper hecho a mano detectan esto por defecto.
- **Discrepancias silenciosas de propiedad de tienda.** Productos, descuentos, claves de licencia y planes de suscripción cuyo `store_id` no coincide con la tienda a la que limitaste la ejecución. Códigos estables: `PRODUCT_WRONG_STORE`, `DISCOUNT_STORE_MISMATCH`, `LICENSE_KEY_STORE_MISMATCH`, `PLAN_STORE_MISMATCH`.
- **Webhook suscrito a los eventos equivocados.** Comparación contra un manifiesto de eventos recomendados (ciclo de vida de pedidos/suscripciones, reembolsos) y eventos más recientes pero opcionales que el SDK no incluye.
- **Desviación de la plataforma.** Una GitHub Action semanal calcula el hash del [registro de cambios de la API de Lemon Squeezy](https://docs.lemonsqueezy.com/api/getting-started/changelog) contra `src/support/changelog-snapshot.json`, actualiza los tipos de la API derivados de la documentación y abre tareas de seguimiento cuando se necesitan decisiones de política. Las adiciones rastreadas incluyen `customer_updated` (2026-02-25), `payment_processor` en Subscription (2025-06-11), Affiliates + `affiliate_activated` (2025-01-21), `quantity` de los ítems de pedido (2024-12-06), estilos de checkout / `skip_trial` / `variant_quantities`, campos de reembolso de facturas de suscripción y `test_mode` en `/v1/users/me` (2024-01-05).
- **El ping-pong entre Postman y el panel.** Una sola llamada a `doctor` reemplaza el ciclo de copiar IDs de la interfaz, pegarlos en archivos de entorno y verificar cada uno a mano.

## fresh-squeezy frente a las alternativas

Cómo se compara una verificación previa al lanzamiento típica de Lemon Squeezy entre las herramientas a las que un desarrollador recurriría de otro modo:

| Capacidad | fresh-squeezy | SDK oficial | Postman | Wrapper hecho a mano |
|---|:---:|:---:|:---:|:---:|
| Detección de discrepancia de modo / clave (`MODE_MISMATCH`) | ✅ | ❌ | ❌ | ❌ |
| Verificaciones cruzadas de propiedad de tienda | ✅ | ❌ | ❌ | ⚠️ manual |
| Comparación de cobertura de eventos de webhook | ✅ | ❌ | ⚠️ manual | ⚠️ manual |
| Validación de descuentos / claves de licencia / planes | ✅ | ❌ | ❌ | ⚠️ manual |
| Rastreo de desviación del registro de cambios | ✅ | ❌ | ❌ | ❌ |
| Códigos de salida + JSON estables y listos para CI | ✅ | ❌ | ❌ | ⚠️ manual |
| Barrido completo en un solo comando (`doctor`) | ✅ | ❌ | ❌ | ❌ |
| Respuestas de la API tipadas | ✅ | ✅ | ❌ | ⚠️ depende |

fresh-squeezy **no** es un reemplazo del SDK oficial — es la verificación previa que ejecutas *junto* a él. Usa el SDK para hacer llamadas a la API; usa fresh-squeezy para comprobar que tu configuración es correcta antes de que esas llamadas lleguen a producción.

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

Las tiendas se resuelven en este orden para cada comando con alcance de tienda: `--store-ids` explícito, luego `--all-stores`, luego una multiselección interactiva en una TTY, y por último una ejecución solo de conexión cuando no hay TTY ni flag (útil como verificación rápida en CI). `doctor` valida la conexión y el acceso a la tienda, además de cualquier flag de recurso explícito; agrega `--all-resources` para descubrir y validar todos los recursos compatibles en la(s) tienda(s) seleccionada(s).

**→ Referencia completa de comandos, flags y resolución de tiendas: [docs/cli-reference.md](./docs/cli-reference.md)**

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

Para ejecuciones multitienda en la capa de biblioteca, llama a `doctor()` en un bucle — la CLI hace exactamente esto. Decide según `issue.code` en la lógica de CI; los códigos son estables entre versiones menores.

Tipos públicos: [`FreshSqueezyClient`](src/createFreshSqueezy.ts), [`ValidationResult<T>`](src/core/types.ts), [`DoctorReport`](src/core/types.ts), interfaces de atributos de recursos bajo [`src/resources`](src/resources), tipos de objetos de Lemon Squeezy generados a partir de la documentación en [`src/generated/lemonSqueezyApiTypes.ts`](src/generated/lemonSqueezyApiTypes.ts), y helpers de aumento del registro de cambios en [`src/augmentations.ts`](src/augmentations.ts).

Para endpoints que aún no están envueltos, usa la vía de escape sin procesar:

```ts
const user = await lemon.request({ path: "/v1/users/me" });
```

## Sandbox frente a producción

Lemon Squeezy sirve ambos modos desde el mismo host de API; el modo se determina por la clave. `fresh-squeezy` compara el modo declarado contra `meta.test_mode` de `/v1/users/me`. Discrepancia = `MODE_MISMATCH`, doctor sale con 1 — la forma más rápida de detectar una clave de producción apuntando a staging antes de que cause daño.

```ts
const lemon = createFreshSqueezy({ mode: "test" });
const result = await lemon.validateConnection();
result.mode;                 // "test" (declared)
result.resource?.actualMode; // "live" — alarm bell
```

El valor por defecto de la CLI es `--mode test`. Anúlalo con `--mode live`. La configuración guiada pide confirmación explícita antes de continuar con una clave de modo live detectada. Para verificaciones nocturnas de desviación de la plataforma en CI, ejecuta `npm run test:live` con `LEMON_SQUEEZY_LIVE_SMOKE=1` y una clave de modo test.

## Variables de entorno

| Variable | Requerida | Propósito |
|----------|----------|---------|
| `LEMON_SQUEEZY_API_KEY` | sí | Token Bearer (biblioteca + CLI) |
| `LEMON_SQUEEZY_MODE` | no | `test` (por defecto) o `live` |
| `LEMON_SQUEEZY_STORE_ID` | no | Valor por defecto de conveniencia para `client.doctor()` — solo biblioteca |

La CLI no lee `LEMON_SQUEEZY_STORE_ID`; usa `--store-ids` o `--all-stores` para que la selección de tienda siga siendo explícita en cada comando.

## Códigos de incidencia

Decide según `issue.code` en CI — todos los códigos son estables entre versiones menores. Los más comunes:

| Código | Significado |
|------|---------|
| `AUTH_FAILED` | Clave de API inválida o faltante |
| `MODE_MISMATCH` | El modo declarado no coincide con el `meta.test_mode` de la clave |
| `STORE_NOT_FOUND` / `STORE_NOT_OWNED` | ID de tienda inválido o propiedad de otra cuenta |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_WRONG_STORE` / `PRODUCT_NO_BUY_URL` | El producto no puede aceptar checkout |
| `WEBHOOK_NOT_FOUND` / `WEBHOOK_EVENTS_MISSING` | URL de webhook no registrada o con suscripción insuficiente |

**→ Referencia completa de códigos de incidencia (descuentos, claves de licencia, planes, variantes, red) con ejemplos de vía de escape: [docs/issue-codes.md](./docs/issue-codes.md)**

## Referencia

Validadores — cada uno devuelve un `ValidationResult` estable:

- **`validateConnection`** — accesibilidad, validez de la clave, presencia de tienda, modo declarado frente al real. [→ código fuente](src/validate/connection.ts)
- **`validateStore`** — el ID de tienda existe y es propiedad de la cuenta de la clave. [→ código fuente](src/validate/store.ts)
- **`validateProduct`** — publicado, en la tienda esperada, tiene variantes activas y una URL de compra. [→ código fuente](src/validate/product.ts)
- **`validateWebhook`** — URL de webhook registrada y suscrita a los eventos recomendados. [→ código fuente](src/validate/webhook.ts)
- **`validateDiscount`** — activo, dentro de la ventana, importe válido, propiedad de tienda coincide. [→ código fuente](src/validate/discount.ts)
- **`validateLicenseKey`** — habilitada, no expirada, activaciones disponibles, propiedad de tienda coincide. [→ código fuente](src/validate/licenseKey.ts)
- **`validateSubscriptionPlan`** — tipo de suscripción, intervalo válido, precio distinto de cero, prueba consistente. [→ código fuente](src/validate/subscriptionPlan.ts)
- **`doctor`** — compone lo anterior en un único `DoctorReport`. [→ código fuente](src/validate/doctor.ts)

La cobertura de recursos se genera a partir de la documentación de objetos de Lemon Squeezy, por lo que la mayoría de los campos recién documentados no necesitan una edición manual:

```bash
npm run generate:api-types
npm run check:api-types
```

## FAQ

### ¿Cómo verifico si mi webhook de Lemon Squeezy está suscrito a los eventos correctos?

Ejecuta `npx fresh-squeezy validate webhook --store-ids <id> --webhook-url <url>`. fresh-squeezy compara los eventos suscritos de tu webhook contra un manifiesto de eventos recomendados de pedidos/suscripciones/reembolsos y reporta `WEBHOOK_EVENTS_MISSING` para las brechas, o `WEBHOOK_NOT_FOUND` si la URL no está registrada en absoluto.

### ¿Cómo detecto una clave de producción de Lemon Squeezy apuntando a una tienda de prueba (staging)?

Esa es la verificación `MODE_MISMATCH`. fresh-squeezy compara el modo que declaraste (`--mode` o `LEMON_SQUEEZY_MODE`) contra el `meta.test_mode` real de la clave obtenido de `/v1/users/me`. Cuando no coinciden, `doctor` sale con 1 — así que una clave de producción usada por accidente en un despliegue de staging (o viceversa) falla la verificación antes de llegar a los usuarios.

### ¿Funciona fresh-squeezy en CI?

Sí. Ejecuta `npx fresh-squeezy doctor --all-stores --all-resources --json` para un barrido completo legible por máquina. Devuelve [códigos de salida](#inicio-en-30-segundos) estables (`0` correcto, `1` errores de validación, `2` fatal) y cadenas `issue.code` estables sobre las que puedes hacer aserciones. No requiere TTY — sin flags de tienda recurre a una verificación rápida solo de conexión.

### ¿Es fresh-squeezy un reemplazo del SDK oficial de Lemon Squeezy?

No. El [SDK oficial](https://github.com/lmsqueezy/lemonsqueezy.js) hace las llamadas a la API; fresh-squeezy es la verificación previa que comprueba que tu configuración es correcta *antes* de que esas llamadas lleguen a producción. Son complementarios — consulta la [tabla comparativa](#fresh-squeezy-frente-a-las-alternativas).

### ¿Qué es la "desviación del registro de cambios" y por qué debería importarme?

Lemon Squeezy lanza cambios en la API (nuevos eventos, nuevos campos, nuevos recursos) más rápido de lo que los SDK cliente los adoptan. fresh-squeezy rastrea el [registro de cambios oficial](https://docs.lemonsqueezy.com/api/getting-started/changelog) contra una instantánea versionada mediante una GitHub Action semanal, de modo que los eventos de webhook o campos de respuesta recién recomendados afloran como trabajo accionable en lugar de quedar sin validar en silencio.

### ¿Puedo usar fresh-squeezy como biblioteca en lugar de la CLI?

Sí. `import { createFreshSqueezy } from "fresh-squeezy"` y llama a `doctor()` o a cualquier validador individual. Cada validador devuelve un `ValidationResult` tipado y estable sobre el que puedes ramificar — consulta [Biblioteca](#biblioteca).

### ¿Qué recursos de Lemon Squeezy puede validar?

Conexión/autenticación, tiendas, productos (y variantes), webhooks, descuentos, claves de licencia y planes de suscripción. Agrega `--all-resources` para descubrir y validar todos los recursos compatibles en la(s) tienda(s) seleccionada(s). Lista completa en la [referencia](#referencia).

## Contribuir

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md). Clona, `npm install`, `npm test`. El proyecto busca mantenerse pequeño y aburrido — con enfoque en validación, una sola capa HTTP y un contrato `issue.code` estable.

## Colaboradores

<a href="https://github.com/YosefHayim/fresh-squeezy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YosefHayim/fresh-squeezy" alt="fresh-squeezy contributors" />
</a>

## Licencia

MIT — consulta [LICENSE](./LICENSE).
