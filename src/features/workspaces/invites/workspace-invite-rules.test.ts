import { describe, expect, it } from "vitest";

import {
	canGrantRole,
	canManageMember,
	getAssignableMemberRoles,
	getDefaultInviteLinkExpiresAt,
	getDefaultInviteRole,
	getGrantableInviteRoles,
	isInviteExpired,
	isValidInviteEmail,
	normalizeInviteEmail,
} from "#/features/workspaces/invites/workspace-invite-rules";

describe("workspace invite rules", () => {
	it("keeps role grants below ownership", () => {
		expect(getGrantableInviteRoles("owner")).toEqual(["admin", "editor", "viewer"]);
		expect(getGrantableInviteRoles("admin")).toEqual(["admin", "editor", "viewer"]);
		expect(getGrantableInviteRoles("editor")).toEqual(["editor", "viewer"]);
		expect(getGrantableInviteRoles("viewer")).toEqual(["viewer"]);

		expect(canGrantRole("owner", "owner")).toBe(false);
		expect(canGrantRole("editor", "admin")).toBe(false);
	});

	it("separates member management authority from invite authority", () => {
		expect(canManageMember("owner", "admin")).toBe(true);
		expect(canManageMember("owner", "owner")).toBe(false);
		expect(canManageMember("admin", "editor")).toBe(true);
		expect(canManageMember("admin", "admin")).toBe(false);
		expect(canManageMember("editor", "viewer")).toBe(false);

		expect(getAssignableMemberRoles("owner")).toEqual(["admin", "editor", "viewer"]);
		expect(getAssignableMemberRoles("admin")).toEqual(["editor", "viewer"]);
	});

	it("chooses sensible default invite roles and expiry times", () => {
		const now = new Date("2026-07-02T12:00:00.000Z");

		expect(getDefaultInviteRole("owner")).toBe("editor");
		expect(getDefaultInviteRole("viewer")).toBe("viewer");
		expect(getDefaultInviteLinkExpiresAt(now)).toEqual(new Date("2026-07-09T12:00:00.000Z"));
		expect(isInviteExpired(new Date("2026-07-02T12:00:00.000Z"), now)).toBe(true);
		expect(isInviteExpired(new Date("2026-07-02T12:00:00.001Z"), now)).toBe(false);
	});

	it("normalizes and validates invite email addresses", () => {
		expect(normalizeInviteEmail("  Ada@Example.COM ")).toBe("ada@example.com");
		expect(isValidInviteEmail("ada@example.com")).toBe(true);
		expect(isValidInviteEmail("missing-domain")).toBe(false);
		expect(isValidInviteEmail("space @example.com")).toBe(false);
	});
});
