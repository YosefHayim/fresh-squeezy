import type { UserAttributes } from "@/shared/attributes.js";
import type { JsonApiDocument } from "@/shared/contracts.js";
import { freshSqueezyErrorOf } from "@/shared/errors.js";
import type { HttpClient, RequestOptions } from "@/shared/http.js";

export type OpVerb =
	| "get"
	| "list"
	| "create"
	| "update"
	| "delete"
	| "cancel"
	| "refund"
	| "generate-invoice"
	| "current-usage";

export interface ResourceVerbSpec {
	resource: string;
	verb: OpVerb;
	docsPath: string;
	destructive?: boolean;
	body?: "required" | "optional" | "none";
	idRole?: "id" | "store" | "parent" | "none";
}

export interface InvokeOpArgs {
	id?: string | number;
	storeId?: string | number;
	parentId?: string | number;
	body?: unknown;
}

interface VerbRule {
	method: NonNullable<RequestOptions["method"]>;
	path: string;
	docs: string;
	body: NonNullable<ResourceVerbSpec["body"]>;
	destructive?: true;
}

const VERB_RULES: Record<OpVerb, VerbRule> = {
	get: { method: "GET", path: "/{id}", docs: "retrieve-{r}", body: "none" },
	list: { method: "GET", path: "", docs: "list-all-{r}s", body: "none" },
	create: { method: "POST", path: "", docs: "create-{r}", body: "required" },
	update: {
		method: "PATCH",
		path: "/{id}",
		docs: "update-{r}",
		body: "required",
	},
	delete: {
		method: "DELETE",
		path: "/{id}",
		docs: "delete-{r}",
		body: "none",
		destructive: true,
	},
	cancel: {
		method: "DELETE",
		path: "/{id}",
		docs: "cancel-{r}",
		body: "none",
		destructive: true,
	},
	refund: {
		method: "POST",
		path: "/{id}/refund",
		docs: "issue-refund",
		body: "optional",
		destructive: true,
	},
	"generate-invoice": {
		method: "POST",
		path: "/{id}/generate-invoice",
		docs: "generate-{r}-invoice",
		body: "optional",
	},
	"current-usage": {
		method: "GET",
		path: "/{id}/current-usage",
		docs: "retrieve-{r}-current-usage",
		body: "none",
	},
};

type ResourceRow = [resource: string, verbs: OpVerb[], listScope?: string];

const RESOURCES: ResourceRow[] = [
	["user", ["get"]],
	["store", ["get", "list"]],
	["product", ["get", "list"], "store"],
	["variant", ["get", "list"], "product"],
	["price", ["get", "list"], "variant"],
	["file", ["get", "list"], "variant"],
	["customer", ["get", "list", "create", "update"], "store"],
	["order", ["get", "list", "refund", "generate-invoice"], "store"],
	["order-item", ["get", "list"], "order"],
	["subscription", ["get", "list", "update", "cancel"], "store"],
	[
		"subscription-item",
		["get", "list", "update", "current-usage"],
		"subscription",
	],
	[
		"subscription-invoice",
		["get", "list", "refund", "generate-invoice"],
		"subscription",
	],
	["usage-record", ["get", "list", "create"], "subscription-item"],
	["discount", ["get", "list", "create", "delete"], "store"],
	["discount-redemption", ["get", "list"], "discount"],
	["license-key", ["get", "list", "update"], "store"],
	["license-key-instance", ["get", "list"], "license-key"],
	["checkout", ["get", "list", "create"], "store"],
	["webhook", ["get", "list", "create", "update", "delete"], "store"],
	["affiliate", ["get", "list"], "store"],
];

const DOCS_PATH_EXCEPTIONS: Record<string, string> = {
	"subscription-invoice:generate-invoice":
		"subscription-invoices/generate-subscription-invoice",
};

const USER_ME_PATH = "/v1/users/me";

const listIdRole = (
	listScope: string | undefined,
): ResourceVerbSpec["idRole"] => {
	const isListUnscoped = !listScope;
	if (isListUnscoped) return "none";
	const isStoreScoped = listScope === "store";
	return isStoreScoped ? "store" : "parent";
};

const toSpec = (
	resource: string,
	verb: OpVerb,
	listScope?: string,
): ResourceVerbSpec => {
	const rule = VERB_RULES[verb];
	const docsPath =
		DOCS_PATH_EXCEPTIONS[`${resource}:${verb}`] ??
		`${resource}s/${rule.docs.replaceAll("{r}", resource)}`;
	const hasIdInPath = rule.path.includes("{id}");
	let idRole: ResourceVerbSpec["idRole"] = hasIdInPath ? "id" : "none";
	const isListVerb = verb === "list";
	if (isListVerb) idRole = listIdRole(listScope);
	const isUserResource = resource === "user";
	if (isUserResource) idRole = "none";
	const isDestructive = rule.destructive;
	return {
		resource,
		verb,
		docsPath,
		body: rule.body,
		...(isDestructive ? { destructive: true } : {}),
		idRole,
	};
};

export const resourceRegistry: readonly ResourceVerbSpec[] = RESOURCES.flatMap(
	([resource, verbs, listScope]) =>
		verbs.map((verb) => toSpec(resource, verb, listScope)),
);

export const normalizeResourceName = (resource: string): string => {
	const normalized = resource.replace(/_/g, "-").toLowerCase();
	// naive singular for simple plurals; leave tokens like "status" alone
	const isSimplePlural = normalized.endsWith("s") && normalized !== "status";
	if (isSimplePlural) return normalized.slice(0, -1);
	return normalized;
};

export const findResourceVerb = (
	resource: string,
	verb: string,
): ResourceVerbSpec | undefined => {
	const key = normalizeResourceName(resource);
	return resourceRegistry.find(
		(entry) => entry.resource === key && entry.verb === verb,
	);
};

export const listRegisteredResources = (): string[] => {
	const resourceNames = resourceRegistry.map((entry) => entry.resource);
	return [...new Set(resourceNames)].sort();
};

export const listRegisteredVerbs = (resource: string): OpVerb[] => {
	const key = normalizeResourceName(resource);
	return resourceRegistry
		.filter((entry) => entry.resource === key)
		.map((entry) => entry.verb)
		.sort();
};

const requireId = (
	args: InvokeOpArgs,
	spec: ResourceVerbSpec,
): string | number => {
	const { id } = args;
	const isIdMissing = id === undefined || id === "";
	if (isIdMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: `--id is required for this ${spec.resource} operation.`,
		});
	}
	return id;
};

const requireStore = (args: InvokeOpArgs): string | number => {
	const { storeId } = args;
	const isStoreIdMissing = storeId === undefined || storeId === "";
	if (isStoreIdMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: "--store-ids (or store id) is required for this list operation.",
		});
	}
	return storeId;
};

const requireParent = (args: InvokeOpArgs, parent: string): string | number => {
	const { parentId } = args;
	const isParentIdMissing = parentId === undefined || parentId === "";
	if (isParentIdMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: `--parent-id (${parent} id) is required for this list operation.`,
		});
	}
	return parentId;
};

const requireBody = (args: InvokeOpArgs): unknown => {
	const isBodyMissing = args.body === undefined;
	if (isBodyMissing) {
		throw freshSqueezyErrorOf({
			code: "MISSING_ARG",
			message: "A JSON body is required (--body or --body-file).",
		});
	}
	return args.body;
};

const listFilter = (
	spec: ResourceVerbSpec,
	args: InvokeOpArgs,
): RequestOptions["query"] => {
	const listScope = RESOURCES.find(
		([resource]) => resource === spec.resource,
	)?.[2];
	const isListUnscoped = !listScope;
	if (isListUnscoped) return undefined;
	const isStoreScoped = listScope === "store";
	const scopeId = isStoreScoped
		? requireStore(args)
		: requireParent(args, listScope);
	const scopeName = listScope.replace(/-/g, "_");
	return { [`filter[${scopeName}_id]`]: String(scopeId) };
};

const requestBody = (rule: VerbRule, args: InvokeOpArgs): unknown => {
	const isBodyRequired = rule.body === "required";
	const isBodyOptional = rule.body === "optional";
	if (isBodyRequired) return requireBody(args);
	if (isBodyOptional) return args.body ?? {};
	return undefined;
};

export const invokeOp = async (
	http: HttpClient,
	resource: string,
	verb: OpVerb | string,
	args: InvokeOpArgs = {},
): Promise<unknown> => {
	const spec = findResourceVerb(resource, verb);
	const isOpUnknown = !spec;
	if (isOpUnknown) {
		throw freshSqueezyErrorOf({
			code: "UNKNOWN_OP",
			message: `Unknown or unsupported op: ${verb} ${resource}. Run \`fresh-squeezy ops --list\`.`,
		});
	}

	const isUserOp = spec.resource === "user";
	if (isUserOp) {
		const userDocument = await http.request<JsonApiDocument<UserAttributes>>({
			path: USER_ME_PATH,
		});
		return userDocument.data;
	}

	const collectionPath = `/v1/${spec.resource}s`;
	const isListOp = spec.verb === "list";
	if (isListOp) {
		const filter = listFilter(spec, args);
		return http.paginate(collectionPath, filter);
	}

	const rule = VERB_RULES[spec.verb];
	const idPath = rule.path.replace("{id}", () => {
		const id = requireId(args, spec);
		return String(id);
	});
	const body = requestBody(rule, args);
	const document = await http.request<{ data?: unknown } | undefined>({
		method: rule.method,
		path: collectionPath + idPath,
		body,
	});
	return document?.data ?? document;
};
