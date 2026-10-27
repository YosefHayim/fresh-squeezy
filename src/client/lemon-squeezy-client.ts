import { createFreshSqueezyError } from "@/client/errors.js";
import type { Http, JsonApiDocument } from "@/client/http.js";
import type {
	CreatableResource,
	CurrentUsage,
	InvoiceBilling,
	InvoiceDownload,
	InvoiceResource,
	ListableResource,
	NewResources,
	RefundableResource,
	RemovableResource,
	ResourceAttributes,
	ResourceType,
	UpdatableResource,
	UpdateAttributes,
} from "@/client/lemon-squeezy-types.js";

const RELATIONSHIP_TYPES = new Map([
	["store", "stores"],
	["variant", "variants"],
	["variants", "variants"],
	["subscription-item", "subscription-items"],
]);

export type ListFilter = Record<string, string | number>;

const createFilterQuery = (filter: ListFilter = {}) => {
	const filterPairs = Object.entries(filter);
	const queryPairs = filterPairs.map(([filterName, filterTerm]) => [
		`filter[${filterName}]`,
		filterTerm,
	]);
	return Object.fromEntries(queryPairs);
};

const createLinkage = (name: string, ids: string | string[]) => {
	const type = RELATIONSHIP_TYPES.get(name);
	const isTypeUnknown = type === undefined;
	if (isTypeUnknown) {
		throw createFreshSqueezyError({
			code: "UNKNOWN_RELATIONSHIP",
			message: `Unknown relationship "${name}".`,
		});
	}
	const isIdList = Array.isArray(ids);
	const linkage = isIdList
		? ids.map((id) => ({ type, id }))
		: { type, id: ids };
	return { data: linkage };
};

const isRelationshipGiven = (
	relationship: [string, string | string[] | undefined],
): relationship is [string, string | string[]] => relationship[1] !== undefined;

const createRelationships = (
	relationships: NewResources[CreatableResource]["relationships"],
) => {
	const relationshipPairs = Object.entries(relationships);
	const givenPairs = relationshipPairs.filter(isRelationshipGiven);
	const linkages = givenPairs.map(([name, ids]) => [
		name,
		createLinkage(name, ids),
	]);
	return Object.fromEntries(linkages);
};

interface ResourceRequest {
	method: "POST" | "PATCH" | "DELETE";
	path: string;
	document?: unknown;
}

const sendResource = async <Resource extends ResourceType>(
	http: Http,
	resourceRequest: ResourceRequest,
) => {
	const resourceDocument =
		await http.request<JsonApiDocument<ResourceAttributes[Resource]>>(
			resourceRequest,
		);
	return resourceDocument.data;
};

const createReadVerbs = (http: Http) => ({
	get: <Resource extends ResourceType>(type: Resource, id: string) =>
		http.getResource<ResourceAttributes[Resource]>(`/v1/${type}/${id}`),

	list: <Resource extends ListableResource>(
		type: Resource,
		filter?: ListFilter,
	) => {
		const query = createFilterQuery(filter);
		return http.getAll<ResourceAttributes[Resource]>(`/v1/${type}`, query);
	},

	currentUsage: (subscriptionItemId: string) =>
		http.request<CurrentUsage>({
			path: `/v1/subscription-items/${subscriptionItemId}/current-usage`,
		}),
});

const createWriteVerbs = (http: Http) => ({
	create: <Resource extends CreatableResource>(
		type: Resource,
		newResource: NewResources[Resource],
	) => {
		const relationships = createRelationships(newResource.relationships);
		const createDocument = {
			data: { type, attributes: newResource.attributes, relationships },
		};
		return sendResource<Resource>(http, {
			method: "POST",
			path: `/v1/${type}`,
			document: createDocument,
		});
	},

	update: <Resource extends UpdatableResource>(
		type: Resource,
		id: string,
		attributes: UpdateAttributes[Resource],
	) => {
		const updateDocument = { data: { type, id, attributes } };
		return sendResource<Resource>(http, {
			method: "PATCH",
			path: `/v1/${type}/${id}`,
			document: updateDocument,
		});
	},

	remove: (type: RemovableResource, id: string) =>
		http.request<undefined>({ method: "DELETE", path: `/v1/${type}/${id}` }),

	cancelSubscription: (id: string) =>
		sendResource<"subscriptions">(http, {
			method: "DELETE",
			path: `/v1/subscriptions/${id}`,
		}),
});

const createBillingVerbs = (http: Http) => ({
	refund: <Resource extends RefundableResource>(
		type: Resource,
		id: string,
		amount?: number,
	) => {
		const refundDocument = { data: { type, id, attributes: { amount } } };
		return sendResource<Resource>(http, {
			method: "POST",
			path: `/v1/${type}/${id}/refund`,
			document: refundDocument,
		});
	},

	generateInvoice: (
		type: InvoiceResource,
		id: string,
		billing: InvoiceBilling,
	) =>
		http.request<InvoiceDownload>({
			method: "POST",
			path: `/v1/${type}/${id}/generate-invoice`,
			query: { ...billing },
		}),
});

export const createLemonSqueezyClient = (http: Http) => ({
	...createReadVerbs(http),
	...createWriteVerbs(http),
	...createBillingVerbs(http),
});
