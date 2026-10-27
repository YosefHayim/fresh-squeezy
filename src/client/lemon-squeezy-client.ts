import type { Http, JsonApiDocument } from "@/client/http.js";
import type {
	CreatableResource,
	CreateInput,
	CurrentUsage,
	InvoiceBilling,
	InvoiceDownload,
	InvoiceResource,
	ListableResource,
	RefundableResource,
	RelationshipName,
	RemovableResource,
	ResourceAttributes,
	ResourceType,
	UpdatableResource,
	UpdateInput,
} from "@/client/lemon-squeezy-types.js";

const RELATIONSHIP_TYPES = {
	store: "stores",
	variant: "variants",
	variants: "variants",
	"subscription-item": "subscription-items",
} as const;

export type ListFilter = Record<string, string | number>;

const buildFilterQuery = (filter: ListFilter = {}) => {
	const filterEntries = Object.entries(filter);
	const queryEntries = filterEntries.map(([filterName, filterValue]) => [
		`filter[${filterName}]`,
		filterValue,
	]);
	return Object.fromEntries(queryEntries);
};

const buildLinkage = (name: RelationshipName, ids: string | string[]) => {
	const type = RELATIONSHIP_TYPES[name];
	const isIdList = Array.isArray(ids);
	const linkage = isIdList
		? ids.map((id) => ({ type, id }))
		: { type, id: ids };
	return { data: linkage };
};

const buildRelationships = (
	relationships: CreateInput[CreatableResource]["relationships"],
) => {
	// Object.entries types its keys as string; the input type already limits them to RelationshipName.
	const relationshipEntries = Object.entries(relationships) as [
		RelationshipName,
		string | string[],
	][];
	const linkages = relationshipEntries.map(([name, ids]) => [
		name,
		buildLinkage(name, ids),
	]);
	return Object.fromEntries(linkages);
};

interface ResourceRequest {
	method: "POST" | "PATCH" | "DELETE";
	path: string;
	document?: unknown;
}

const sendResource = async <Type extends ResourceType>(
	http: Http,
	resourceRequest: ResourceRequest,
) => {
	const resourceDocument =
		await http.request<JsonApiDocument<ResourceAttributes[Type]>>(
			resourceRequest,
		);
	return resourceDocument.data;
};

const createReadVerbs = (http: Http) => ({
	get: <Type extends ResourceType>(type: Type, id: string) =>
		http.getResource<ResourceAttributes[Type]>(`/v1/${type}/${id}`),

	list: <Type extends ListableResource>(type: Type, filter?: ListFilter) => {
		const query = buildFilterQuery(filter);
		return http.getAll<ResourceAttributes[Type]>(`/v1/${type}`, query);
	},

	currentUsage: (subscriptionItemId: string) =>
		http.request<CurrentUsage>({
			path: `/v1/subscription-items/${subscriptionItemId}/current-usage`,
		}),
});

const createWriteVerbs = (http: Http) => ({
	create: <Type extends CreatableResource>(
		type: Type,
		newResource: CreateInput[Type],
	) => {
		const relationships = buildRelationships(newResource.relationships);
		const createDocument = {
			data: { type, attributes: newResource.attributes, relationships },
		};
		return sendResource<Type>(http, {
			method: "POST",
			path: `/v1/${type}`,
			document: createDocument,
		});
	},

	update: <Type extends UpdatableResource>(
		type: Type,
		id: string,
		attributes: UpdateInput[Type],
	) => {
		const updateDocument = { data: { type, id, attributes } };
		return sendResource<Type>(http, {
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
	refund: <Type extends RefundableResource>(
		type: Type,
		id: string,
		amount?: number,
	) => {
		const refundDocument = { data: { type, id, attributes: { amount } } };
		return sendResource<Type>(http, {
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
