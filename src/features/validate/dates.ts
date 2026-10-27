export const isPast = (isoDate: string | null): boolean =>
	isoDate !== null && new Date(isoDate) < new Date();

export const isFuture = (isoDate: string | null): boolean =>
	isoDate !== null && new Date(isoDate) > new Date();
