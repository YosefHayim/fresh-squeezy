// Preloaded into the spawned CLI (`node --import`) so the real binary runs end to end
// without network. Serves a tiny in-memory discount API (logs DELETEs to stderr) and a
// 3,000-product list large enough to overflow a 64 KB stdout pipe buffer.
const discounts = new Map([
	["1", { code: "KEEPME", name: "Keep" }],
	["2", { code: "NSAHTEST", name: "Test A" }],
	["3", { code: "NSAHTEST2", name: "Test B" }],
]);

const json = (status, body) => {
	const payload = JSON.stringify(body);
	return new Response(payload, {
		status,
		headers: { "content-type": "application/vnd.api+json" },
	});
};

const urlOfInput = (input) => {
	const isInputAString = typeof input === "string";
	return new URL(isInputAString ? input : (input.url ?? String(input)));
};

globalThis.fetch = async (input, init) => {
	const url = urlOfInput(input);
	const method = (init?.method ?? "GET").toUpperCase();
	const isGet = method === "GET";

	const isDiscountList = isGet && url.pathname === "/v1/discounts";
	if (isDiscountList) {
		const discountList = [...discounts].map(([id, attributes]) => ({
			type: "discounts",
			id,
			attributes: { store_id: 1, ...attributes },
		}));
		return json(200, {
			data: discountList,
			meta: { page: { currentPage: 1, lastPage: 1 } },
		});
	}

	const isProductList = isGet && url.pathname === "/v1/products";
	if (isProductList) {
		const productList = Array.from({ length: 3000 }, (_, index) => ({
			type: "products",
			id: String(index),
			attributes: {
				store_id: 1,
				name: `Product ${index} ${"x".repeat(60)}`,
				status: "published",
			},
		}));
		return json(200, {
			data: productList,
			meta: { page: { currentPage: 1, lastPage: 1 } },
		});
	}

	const discountMatch = url.pathname.match(/^\/v1\/discounts\/(\d+)$/);
	const isDiscountDelete = method === "DELETE" && discountMatch;
	if (isDiscountDelete) {
		const discountId = discountMatch[1];
		process.stderr.write(`FAKE_DELETE ${discountId}\n`);
		const wasDeleted = discounts.delete(discountId);
		const notFoundBody = {
			errors: [{ status: "404", code: "not_found", title: "Not found" }],
		};
		return wasDeleted ? json(200, {}) : json(404, notFoundBody);
	}
	return json(404, {
		errors: [{ status: "404", code: "no_route", title: url.pathname }],
	});
};
