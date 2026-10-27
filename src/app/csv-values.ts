export const splitCsv = (text: string): string[] => {
	const entries = text.split(",");
	const trimmedEntries = entries.map((entry) => entry.trim());
	return trimmedEntries.filter(Boolean);
};

export const uniqueValues = (values: string[]): string[] => {
	const trimmedValues = values.map((value) => value.trim());
	const nonEmptyValues = trimmedValues.filter(Boolean);
	const distinctValues = new Set(nonEmptyValues);
	return Array.from(distinctValues);
};
