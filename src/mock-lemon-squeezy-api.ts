import { http, HttpResponse, type HttpHandler } from "msw";
import { setupServer } from "msw/node";
import { readClientSettings } from "@/client/environment.js";
import { createHttp } from "@/client/http.js";
import { STORES_COLLECTION, USER_DOCUMENT } from "@/lemon-squeezy-fixtures.js";

const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com";
const JSON_API_CONTENT_TYPE = "application/vnd.api+json";
const HTTP_STATUS_OK = 200;

interface SentRequest {
	method: string;
	url: URL;
	headers: Headers;
	requestDocument: unknown;
}

interface FilteredListReply {
	collection: string;
	filterName: string;
	filterValue: string;
	replyDocument: unknown;
	status: number;
}

const recordedRequests: Request[] = [];

export const mockLemonSqueezyServer = setupServer();

mockLemonSqueezyServer.events.on("request:start", ({ request }) => {
	recordedRequests.push(request.clone());
});

const createJsonApiReply = (replyDocument: unknown, status: number) => {
	const isThereNoDocument = replyDocument == null;

	if (isThereNoDocument) {
		// undici rejects a body on a 204 reply, so the reply has none.
		return new HttpResponse(null, { status });
	}

	return new HttpResponse(JSON.stringify(replyDocument), {
		status,
		headers: { "content-type": JSON_API_CONTENT_TYPE },
	});
};

const replyWhenFilterMatches = (filteredList: FilteredListReply) =>
	http.get(
		`${LEMON_SQUEEZY_API_URL}/v1/${filteredList.collection}`,
		({ request }) => {
			const requestUrl = new URL(request.url);
			const sentFilterValue = requestUrl.searchParams.get(
				filteredList.filterName,
			);
			const isFilterMatching = sentFilterValue === filteredList.filterValue;

			// Returning nothing lets the next handler try the request.
			if (!isFilterMatching) {
				return undefined;
			}

			return createJsonApiReply(
				filteredList.replyDocument,
				filteredList.status,
			);
		},
	);

export const replyAtPath = (
	path: string,
	replyDocument: unknown,
	status = HTTP_STATUS_OK,
): HttpHandler =>
	http.get(`${LEMON_SQUEEZY_API_URL}${path}`, () =>
		createJsonApiReply(replyDocument, status),
	);

export const replyWithPlainMessage = (
	path: string,
	plainMessage: string,
	status: number,
): HttpHandler =>
	http.get(
		`${LEMON_SQUEEZY_API_URL}${path}`,
		() => new HttpResponse(plainMessage, { status }),
	);

export const replyToStoreList = (
	collection: string,
	replyDocument: unknown,
	status = HTTP_STATUS_OK,
): HttpHandler =>
	replyWhenFilterMatches({
		collection,
		filterName: "filter[store_id]",
		filterValue: "42",
		replyDocument,
		status,
	});

export const replyToVariantList = (
	productId: string,
	replyDocument: unknown,
	status = HTTP_STATUS_OK,
): HttpHandler =>
	replyWhenFilterMatches({
		collection: "variants",
		filterName: "filter[product_id]",
		filterValue: productId,
		replyDocument,
		status,
	});

export const replyToEveryRequest = (
	replyDocument: unknown,
	status = HTTP_STATUS_OK,
): HttpHandler =>
	http.all("*", () => createJsonApiReply(replyDocument, status));

export const replyToPages = (
	path: string,
	lastPage: number,
	idsOfPage: (page: number) => string[],
): HttpHandler =>
	http.get(`${LEMON_SQUEEZY_API_URL}${path}`, ({ request }) => {
		const requestUrl = new URL(request.url);
		const page = Number(requestUrl.searchParams.get("page[number]") ?? "1");
		const resources = idsOfPage(page).map((id) => ({
			type: "products",
			id,
			attributes: {},
		}));
		const pageDocument = {
			data: resources,
			meta: { page: { currentPage: page, lastPage, total: 6 } },
		};

		return createJsonApiReply(pageDocument, HTTP_STATUS_OK);
	});

export const SIGNED_IN_HANDLERS = [
	replyAtPath("/v1/users/me", USER_DOCUMENT),
	replyAtPath("/v1/stores", STORES_COLLECTION),
];

export const addTestHandlers = (handlers: HttpHandler[]) => {
	mockLemonSqueezyServer.use(...handlers);
};

export const createTestHttp = (handlers: HttpHandler[], apiKey = "k") => {
	addTestHandlers(handlers);

	const clientSettings = readClientSettings({ apiKey });
	return createHttp(clientSettings);
};

const readSentRequest = async (request: Request): Promise<SentRequest> => {
	const sentText = await request.clone().text();
	const isThereNoSentText = sentText === "";
	const requestDocument: unknown = isThereNoSentText
		? undefined
		: JSON.parse(sentText);

	return {
		method: request.method,
		url: new URL(request.url),
		headers: request.headers,
		requestDocument,
	};
};

export const readRecordedRequests = async (): Promise<SentRequest[]> =>
	Promise.all(recordedRequests.map(readSentRequest));

export const readLastRequest = async (): Promise<SentRequest> => {
	const sentRequests = await readRecordedRequests();
	const lastSentRequest = sentRequests.at(-1);
	const isThereNoSentRequest = lastSentRequest == null;

	if (isThereNoSentRequest) {
		throw new Error("No request was sent to the mock Lemon Squeezy API.");
	}

	return lastSentRequest;
};

export const clearRecordedRequests = () => {
	recordedRequests.length = 0;
};
