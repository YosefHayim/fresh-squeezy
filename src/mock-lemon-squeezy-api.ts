import { type HttpHandler, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
	LEMON_SQUEEZY_API_URL,
	readClientSettings,
} from "@/client/environment.js";
import { createHttp, type Http } from "@/client/http.js";
import { STORES_COLLECTION, USER_DOCUMENT } from "@/lemon-squeezy-fixtures.js";

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

const replyToFilteredList = (filteredList: FilteredListReply) =>
	http.get(
		`${LEMON_SQUEEZY_API_URL}/v1/${filteredList.collection}`,
		({ request }) => {
			const requestUrl = new URL(request.url);
			const sentFilterValue = requestUrl.searchParams.get(
				filteredList.filterName,
			);
			const isOtherFilterValue = sentFilterValue !== filteredList.filterValue;

			// Returning nothing lets the next handler try the request.
			if (isOtherFilterValue) {
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
	replyToFilteredList({
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
	replyToFilteredList({
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
	listPageIds: (page: number) => string[],
): HttpHandler =>
	http.get(`${LEMON_SQUEEZY_API_URL}${path}`, ({ request }) => {
		const requestUrl = new URL(request.url);
		const sentPageNumber = requestUrl.searchParams.get("page[number]") ?? "1";
		const page = Number(sentPageNumber);

		const resources = listPageIds(page).map((id) => ({
			type: "products",
			id,
			attributes: {},
		}));
		const resourceTotal = 6;
		const pageDocument = {
			data: resources,
			meta: { page: { currentPage: page, lastPage, total: resourceTotal } },
		};

		return createJsonApiReply(pageDocument, HTTP_STATUS_OK);
	});

export const SIGNED_IN_HANDLERS = [
	replyAtPath("/v1/users/me", USER_DOCUMENT),
	replyAtPath("/v1/stores", STORES_COLLECTION),
];

export const createTestHttp = (handlers: HttpHandler[], apiKey = "k"): Http => {
	mockLemonSqueezyServer.use(...handlers);

	const clientSettings = readClientSettings({ apiKey });
	return createHttp(clientSettings);
};

const readRequestDocument = (sentText: string): unknown => {
	const isThereNoSentText = sentText === "";

	if (isThereNoSentText) {
		return null;
	}

	return JSON.parse(sentText);
};

const readSentRequest = async (request: Request): Promise<SentRequest> => {
	const sentText = await request.clone().text();
	const requestDocument = readRequestDocument(sentText);

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
