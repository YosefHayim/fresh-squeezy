import { afterAll, afterEach, beforeAll } from "vitest";
import {
	clearRecordedRequests,
	mockLemonSqueezyServer,
} from "@/mock-lemon-squeezy-api.js";

beforeAll(() => {
	mockLemonSqueezyServer.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
	mockLemonSqueezyServer.resetHandlers();
	clearRecordedRequests();
});

afterAll(() => {
	mockLemonSqueezyServer.close();
});
