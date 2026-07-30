import { YServer } from "y-partyserver";

/**
 * Base for collaborative session Durable Objects whose canonical content lives
 * in an in-memory Yjs document that `onLoad` hydrates from durable storage.
 *
 * These sessions are reached two ways. Browser editors connect over
 * `fetch`/WebSocket, which runs `onStart` — and therefore `onLoad` — before any
 * handler touches the document. Server tools instead call methods directly over
 * native Durable Object RPC, which does not run `onStart`. A content method
 * invoked cold via RPC would read or edit a freshly constructed, empty document:
 * returning blank content, or checkpointing an empty document over real content.
 *
 * Any RPC method that reads or writes the document must `await
 * this.ensureLoaded()` first. Methods that only touch durable storage (deletion,
 * for example) must not, so hydration stays opt-in per method rather than a
 * blanket cost. New editable item types extend this base so the guarantee — and
 * the reasoning behind it — live in one place.
 */
export abstract class CollaborativeContentSession extends YServer {
	/**
	 * Runs `onStart`/`onLoad` for this instance if they have not already. Cheap
	 * and idempotent once started. `__unsafe_ensureInitialized` is the framework's
	 * sanctioned escape hatch for Durable Objects reached via native RPC; keeping
	 * the single call here means content methods never touch an unhydrated
	 * document and the rationale is not repeated at every call site.
	 */
	protected async ensureLoaded(): Promise<void> {
		await this.__unsafe_ensureInitialized();
	}
}
