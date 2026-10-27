import {
	liveUserDoc,
	unauthorizedError,
	userDoc,
} from "@e2e/fixtures/sandbox/data.js";
import { makeClient, route, SIGNED_IN_ROUTES } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateConnection } from "./connection.js";

const liveRoutes = [
	route("/v1/users/me", liveUserDoc),
	...SIGNED_IN_ROUTES.slice(1),
];

test("validateConnection returns ok when key auths and stores are reachable", async () => {
	const http = makeClient(SIGNED_IN_ROUTES);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.mode).toBe("test");
	expect(connectionValidation.resource?.storeCount).toBe(1);
	expect(connectionValidation.resource?.storeIds).toEqual(["42"]);
});

test("validateConnection warns when no stores reachable", async () => {
	const http = makeClient([
		...SIGNED_IN_ROUTES.slice(0, 1),
		route("/v1/stores", { data: [] }),
	]);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.issues[0]?.code).toBe("STORE_NOT_FOUND");
	expect(connectionValidation.issues[0]?.severity).toBe("warning");
});

test("validateConnection surfaces AUTH_FAILED on 401", async () => {
	const http = makeClient([route("/v1/users/me", unauthorizedError, 401)]);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(false);
	expect(connectionValidation.issues[0]?.code).toBe("AUTH_FAILED");
});

test("validateConnection flags MODE_MISMATCH when declared mode differs from meta.test_mode", async () => {
	const http = makeClient(liveRoutes);

	const connectionValidation = await validateConnection(http, "test");

	expect(connectionValidation.ok).toBe(false);
	expect(connectionValidation.resource?.actualMode).toBe("live");
	expect(connectionValidation.resource?.declaredMode).toBe("test");
	const mismatch = connectionValidation.issues.find(
		(entry) => entry.code === "MODE_MISMATCH",
	);
	expect(mismatch?.severity).toBe("error");
	expect(mismatch?.context).toMatchObject({ declared: "test", actual: "live" });
});

test("validateConnection passes when declared mode matches meta.test_mode", async () => {
	const http = makeClient(liveRoutes);

	const connectionValidation = await validateConnection(http, "live");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.resource?.actualMode).toBe("live");
});

test("validateConnection skips mode check when meta.test_mode is absent", async () => {
	const docWithoutMeta = { data: userDoc.data };
	const http = makeClient([
		route("/v1/users/me", docWithoutMeta),
		...SIGNED_IN_ROUTES.slice(1),
	]);

	const connectionValidation = await validateConnection(http, "live");

	expect(connectionValidation.ok).toBe(true);
	expect(connectionValidation.resource?.actualMode).toBeUndefined();
	expect(
		connectionValidation.issues.find((entry) => entry.code === "MODE_MISMATCH"),
	).toBeUndefined();
});
