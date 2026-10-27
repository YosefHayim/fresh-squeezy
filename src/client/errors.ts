export interface FreshSqueezyError extends Error {
	name: "FreshSqueezyError";
	code: string;
	status?: number;
	detail?: unknown;
}

export interface FreshSqueezyErrorFields {
	code: string;
	message: string;
	status?: number;
	detail?: unknown;
}

export const createFreshSqueezyError = (
	fields: FreshSqueezyErrorFields,
): FreshSqueezyError => {
	const { code, message, status, detail } = fields;
	const error = new Error(message);
	// A plain Error with fields survives duplicated bundles; consumers branch with isFreshSqueezyError.
	return Object.assign(error, {
		name: "FreshSqueezyError" as const,
		code,
		status,
		detail,
	});
};

export const isFreshSqueezyError = (
	error: unknown,
): error is FreshSqueezyError => {
	const isErrorObject = error instanceof Error;
	return isErrorObject && error.name === "FreshSqueezyError" && "code" in error;
};
