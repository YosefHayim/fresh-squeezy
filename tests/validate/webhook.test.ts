import { describe, expect, it } from "vitest";
import { HttpClient } from "../../src/core/http.js";
import { resolveConfig } from "../../src/core/config.js";
import { validateWebhook } from "../../src/validate/webhook.js";
import { createMockFetch, pathIsWithQuery } from "../helpers/mockFetch.js";
import {
  webhooksCollectionComplete,
  webhooksCollectionEmpty,
  webhooksCollectionMissingEvents,
} from "../fixtures/sandbox/data.js";

function makeClient(routes: Parameters<typeof createMockFetch>[0]) {
  const { fetch } = createMockFetch(routes);
  return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
}

describe("validateWebhook", () => {
  const URL = "https://app.example.com/api/webhooks/lemon-squeezy";

  it("passes when every recommended event is subscribed", async () => {
    const http = makeClient([
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionComplete,
      },
    ]);

    const result = await validateWebhook(http, "test", { storeId: 42, url: URL });

    expect(result.ok).toBe(true);
    expect(result.issues.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });

  it("flags missing recommended events as errors", async () => {
    const http = makeClient([
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionMissingEvents,
      },
    ]);

    const result = await validateWebhook(http, "test", { storeId: 42, url: URL });

    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain("WEBHOOK_EVENTS_MISSING");
  });

  it("returns WEBHOOK_NOT_FOUND when the store has no matching webhook", async () => {
    const http = makeClient([
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionEmpty,
      },
    ]);

    const result = await validateWebhook(http, "test", { storeId: 42, url: URL });

    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("WEBHOOK_NOT_FOUND");
  });

  it("normalizes trailing slashes when matching URLs", async () => {
    const http = makeClient([
      {
        match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
        status: 200,
        body: webhooksCollectionComplete,
      },
    ]);

    const result = await validateWebhook(http, "test", {
      storeId: 42,
      url: `${URL}/`,
    });

    expect(result.ok).toBe(true);
  });
});
