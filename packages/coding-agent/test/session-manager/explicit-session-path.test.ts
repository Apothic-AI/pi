import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager, sessionIdFromSessionFile } from "../../src/core/session-manager.ts";

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The id in the file's first line, or undefined when nothing has been written yet. */
function headerIdOf(path: string): string | undefined {
	if (!existsSync(path)) return undefined;
	const first = readFileSync(path, "utf8").split("\n")[0];
	if (!first) return undefined;
	const parsed = JSON.parse(first) as { type?: string; id?: string };
	return parsed.type === "session" ? parsed.id : undefined;
}

describe("sessionIdFromSessionFile", () => {
	it("extracts the uuid Pi encodes in a session filename", () => {
		expect(
			sessionIdFromSessionFile(
				"/x/sessions/--home-a-b--/2026-11-25T07-02-45-000Z_01a21183-945d-7000-8000-000000000001.jsonl",
			),
		).toBe("01a21183-945d-7000-8000-000000000001");
	});

	it("returns undefined for names with no session uuid", () => {
		expect(sessionIdFromSessionFile("/x/notes.jsonl")).toBeUndefined();
		expect(sessionIdFromSessionFile("/x/2026-11-25T07-02-45-000Z.jsonl")).toBeUndefined();
		expect(sessionIdFromSessionFile("/x/2026-11-25T07-02-45-000Z_not-a-uuid.jsonl")).toBeUndefined();
	});
});

describe("opening an explicit --session path", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "explicit-session-path-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("adopts the id in a filename whose file does not exist yet", () => {
		const id = "01a21183-945d-7000-8000-000000000001";
		const path = join(tempDir, `2026-11-25T07-02-45-000Z_${id}.jsonl`);

		const session = SessionManager.open(path, tempDir);

		expect(session.getSessionId()).toBe(id);
		expect(session.getSessionFile()).toBe(path);
		// Lazy write: opening alone must not create the file or a second session file.
		expect(existsSync(path)).toBe(false);
		expect(readdirSync(tempDir)).toEqual([]);
	});

	it("materialises a header that agrees with the filename on the first write", () => {
		const id = "01a21183-945d-7000-8000-000000000001";
		const path = join(tempDir, `2026-11-25T07-02-45-000Z_${id}.jsonl`);

		const session = SessionManager.open(path, tempDir);
		session.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });

		expect(existsSync(path)).toBe(true);
		expect(headerIdOf(path)).toBe(id);
		expect(session.getSessionFile()).toBe(path);
		// No second file named after a minted id.
		expect(readdirSync(tempDir)).toEqual([path.slice(tempDir.length + 1)]);
	});

	it("keeps a generated id when the filename carries no session id", () => {
		const path = join(tempDir, "named-by-hand.jsonl");

		const session = SessionManager.open(path, tempDir);

		expect(session.getSessionId()).toMatch(UUID_V7_RE);
		expect(session.getSessionFile()).toBe(path);
	});

	it("adopts the filename id when the explicit file exists but is empty", () => {
		const id = "01a213b0-9ce4-7000-8000-000000000002";
		const path = join(tempDir, `2026-11-25T07-02-45-000Z_${id}.jsonl`);
		writeFileSync(path, "");

		const session = SessionManager.open(path, tempDir);

		expect(session.getSessionId()).toBe(id);
		expect(headerIdOf(path)).toBe(id);
	});

	it("still loads an existing session under its own header id", () => {
		const headerId = "01a213b0-9ce4-7000-8000-000000000002";
		const path = join(tempDir, `2026-11-25T07-02-45-000Z_${headerId}.jsonl`);
		writeFileSync(
			path,
			`${JSON.stringify({
				type: "session",
				version: 3,
				id: headerId,
				timestamp: "2026-11-25T07:02:45.000Z",
				cwd: tempDir,
			})}\n`,
		);

		const session = SessionManager.open(path, tempDir);

		expect(session.getSessionId()).toBe(headerId);
		expect(session.getSessionFile()).toBe(path);
	});
});
