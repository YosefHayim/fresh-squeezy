// Preloaded into the spawned CLI (`node --import`) so the real binary runs end to end
// without network. Serves a tiny in-memory discount API (logs DELETEs to stderr) and a
// 3,000-product list large enough to overflow a 64 KB stdout pipe buffer.
const discounts = new Map([
  ["1", { code: "KEEPME", name: "Keep" }],
  ["2", { code: "NSAHTEST", name: "Test A" }],
  ["3", { code: "NSAHTEST2", name: "Test B" }],
]);

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : (input.url ?? String(input)));
  const method = (init?.method ?? "GET").toUpperCase();
  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/vnd.api+json" },
    });

  if (method === "GET" && url.pathname === "/v1/discounts") {
    const data = [...discounts].map(([id, attributes]) => ({
      type: "discounts",
      id,
      attributes: { store_id: 1, ...attributes },
    }));
    return json(200, { data, meta: { page: { currentPage: 1, lastPage: 1 } } });
  }

  if (method === "GET" && url.pathname === "/v1/products") {
    const data = Array.from({ length: 3000 }, (_, index) => ({
      type: "products",
      id: String(index),
      attributes: { store_id: 1, name: `Product ${index} ${"x".repeat(60)}`, status: "published" },
    }));
    return json(200, { data, meta: { page: { currentPage: 1, lastPage: 1 } } });
  }

  const match = url.pathname.match(/^\/v1\/discounts\/(\d+)$/);
  if (method === "DELETE" && match) {
    process.stderr.write(`FAKE_DELETE ${match[1]}\n`);
    return discounts.delete(match[1])
      ? json(200, {})
      : json(404, { errors: [{ status: "404", code: "not_found", title: "Not found" }] });
  }
  return json(404, { errors: [{ status: "404", code: "no_route", title: url.pathname }] });
};
