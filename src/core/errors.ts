// A plain Error with fields: no class, so it survives duplicated bundles; consumers branch with `isFreshSqueezyError`.
export type FreshSqueezyError = Error & {
  name: "FreshSqueezyError";
  code: string;
  status?: number;
  detail?: unknown;
};

export const freshSqueezyErrorOf = (fields: {
  code: string;
  message: string;
  status?: number;
  detail?: unknown;
}): FreshSqueezyError => {
  const { code, message, status, detail } = fields;
  return Object.assign(new Error(message), {
    name: "FreshSqueezyError" as const,
    code,
    status,
    detail,
  });
};

export const isFreshSqueezyError = (error: unknown): error is FreshSqueezyError => {
  const isErrorObject = error instanceof Error;
  return isErrorObject && error.name === "FreshSqueezyError" && "code" in error;
};
