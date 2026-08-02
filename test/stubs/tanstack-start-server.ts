// Worker tests drive Durable Objects and server modules directly, with no
// TanStack request in scope. Importing the real module would pull the Start
// server handler and its build-time virtual entries into the test graph.
//
// This throws rather than returning empty headers: a test that reaches the
// ambient request context has found a code path that cannot run inside a
// Durable Object, and should say so instead of quietly passing on blank values.
export function getRequestHeaders(): Headers {
	throw new Error(
		"getRequestHeaders() is unavailable in worker tests: there is no TanStack request. " +
			"Pass explicit headers, or move this call behind a request-scoped entry point.",
	);
}
