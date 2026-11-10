export const isExpired = (expiresAt: string | null, now: Date) => {
	const isExpirySet = expiresAt != null;
	return isExpirySet && Date.parse(expiresAt) < now.getTime();
};
