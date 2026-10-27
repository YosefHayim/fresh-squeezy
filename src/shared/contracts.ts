export type ValidationSeverity = "info" | "warning" | "error";

export type Mode = "test" | "live";

export type ResourceId = string | number;

export interface ValidationIssue {
	code: string;
	severity: ValidationSeverity;
	message: string;
	suggestedFix?: string;
	context?: Record<string, string | number | boolean | null>;
}

export interface ValidationTarget {
	label: string;
	id?: string;
	url?: string;
}

export interface ValidationResult<T = unknown> {
	ok: boolean;
	mode: Mode;
	name: string;
	target?: ValidationTarget;
	resource?: T;
	issues: ValidationIssue[];
}

export interface DoctorReport {
	ok: boolean;
	mode: Mode;
	results: ValidationResult[];
}

export interface FreshSqueezyConfig {
	apiKey?: string;
	storeId?: ResourceId;
	mode?: Mode;
	baseUrl?: string;
	fetch?: typeof fetch;
}

export interface ResolvedConfig {
	apiKey: string;
	storeId?: string;
	mode: Mode;
	baseUrl: string;
	fetch: typeof fetch;
}

export interface JsonApiResource<TAttributes = Record<string, unknown>> {
	type: string;
	id: string;
	attributes: TAttributes;
	relationships?: Record<string, unknown>;
	links?: Record<string, string>;
}

export interface JsonApiDocument<TAttributes = Record<string, unknown>> {
	data: JsonApiResource<TAttributes>;
	links?: Record<string, string>;
	meta?: Record<string, unknown>;
}

export interface JsonApiCollection<TAttributes = Record<string, unknown>> {
	data: JsonApiResource<TAttributes>[];
	links?: Record<string, string>;
	meta?: { page?: { currentPage: number; lastPage: number; total: number } };
}
