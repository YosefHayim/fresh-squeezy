import { pathToFileURL } from "node:url";

export const fetchText = async (url, userAgent) => {
	const response = await fetch(url, {
		headers: { "user-agent": userAgent, accept: "text/html,*/*" },
	});
	const isResponseFailed = !response.ok;
	if (isResponseFailed) {
		throw new Error(`Fetch failed ${response.status} for ${url}`);
	}
	return response.text();
};

// Importing a script from a test must not start it, so main runs only when invoked directly.
export const runWhenInvokedDirectly = (scriptUrl, main) => {
	const scriptPath = process.argv[1];
	const isRunAsModule =
		!scriptPath || scriptUrl !== pathToFileURL(scriptPath).href;
	if (isRunAsModule) return;
	main().catch((error) => {
		const isRealError = error instanceof Error;
		const errorText = isRealError
			? (error.stack ?? error.message)
			: String(error);
		process.stderr.write(`${errorText}\n`);
		process.exit(2);
	});
};
