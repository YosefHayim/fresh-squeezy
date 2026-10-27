import {
	listRegisteredResources,
	resourceRegistry,
} from "@/features/ops/resource-registry.js";

export const runOpsCatalogCommand = (options: { json?: boolean }): number => {
	if (options.json) {
		const catalog = {
			resources: listRegisteredResources(),
			ops: resourceRegistry,
		};
		const catalogText = JSON.stringify(catalog, null, 2);
		process.stdout.write(`${catalogText}\n`);
		return 0;
	}
	process.stdout.write(
		"Docs-backed ops (Lemon Squeezy official API only):\n\n",
	);
	for (const entry of resourceRegistry) {
		const hasBody = entry.body && entry.body !== "none";
		const flagList = [
			entry.destructive ? "destructive" : undefined,
			hasBody ? `body=${entry.body}` : undefined,
		].filter(Boolean);
		const flags = flagList.join(", ");
		const flagsSuffix = flags ? `  (${flags})` : "";
		const verbColumn = entry.verb.padEnd(18);
		const resourceColumn = entry.resource.padEnd(22);
		process.stdout.write(
			`  ${verbColumn} ${resourceColumn} ${entry.docsPath}${flagsSuffix}\n`,
		);
	}
	process.stdout.write(
		"\nCatalog resources (product, variant, price, file, store, …) are read-only in the API.\n",
	);
	return 0;
};
