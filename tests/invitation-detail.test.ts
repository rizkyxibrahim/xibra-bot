import { describe, expect, it } from "vitest";
import type { InvitationDetail } from "../src/api/client.js";
import { formatInvitationDetail, formatWib } from "../src/bot/format.js";

function detail(overrides: Partial<InvitationDetail> = {}): InvitationDetail {
  return {
    id: 7,
    status: "pending",
    note: null,
    expires_at: "2026-11-15T12:14:03+07:00",
    created_by: { id: 1, name: "Owner", username: "owner" },
    role: { name: "member", label: "Member" },
    created_at: "2026-11-14T12:14:03+07:00",
    ...overrides,
  };
}

describe("formatWib", () => {
  it("formats a Jakarta timestamp", () => {
    expect(formatWib("2026-11-15T12:14:03+07:00")).toBe(
      "15 Nov 2026, 12:14 WIB",
    );
  });

  it("converts UTC to Jakarta time", () => {
    expect(formatWib("2026-11-15T05:14:03Z")).toBe("15 Nov 2026, 12:14 WIB");
    expect(formatWib("2026-12-31T20:30:00Z")).toBe("1 Jan 2027, 03:30 WIB");
  });

  it("handles missing and invalid values", () => {
    expect(formatWib(null)).toBe("-");
    expect(formatWib(undefined)).toBe("-");
    expect(formatWib("not a date")).toBe("not a date");
  });
});

describe("formatInvitationDetail", () => {
  it("describes a pending invitation and explains why the code is gone", () => {
    const text = formatInvitationDetail(detail({ note: "Tester" }));

    expect(text).toContain("Undangan #7");
    expect(text).toContain("Status: menunggu");
    expect(text).toContain("Peran: Member");
    expect(text).toContain("Catatan: Tester");
    expect(text).toContain("Dibuat oleh: Owner (@owner)");
    expect(text).toContain("Berlaku sampai: 15 Nov 2026, 12:14 WIB");
    expect(text).toContain("tidak bisa ditampilkan lagi");
  });

  it("shows who revoked it and drops the code hint", () => {
    const text = formatInvitationDetail(
      detail({
        status: "revoked",
        revoked_by: { id: 1, name: "Owner", username: "owner" },
        revoked_at: "2026-11-14T13:00:00+07:00",
      }),
    );

    expect(text).toContain("Status: dicabut");
    expect(text).toContain("Dicabut oleh: Owner (@owner)");
    expect(text).toContain("Dicabut pada: 14 Nov 2026, 13:00 WIB");
    expect(text).not.toContain("tidak bisa ditampilkan lagi");
  });

  it("shows who redeemed it", () => {
    const text = formatInvitationDetail(
      detail({
        status: "redeemed",
        redeemed_by: { id: 2, name: "Sari", username: "sari" },
        redeemed_at: "2026-11-14T14:00:00+07:00",
      }),
    );

    expect(text).toContain("Status: sudah dipakai");
    expect(text).toContain("Dipakai oleh: Sari (@sari)");
  });

  it("escapes user supplied text for HTML", () => {
    const text = formatInvitationDetail(
      detail({
        note: "<b>x</b>",
        created_by: { id: 1, name: "A & B", username: "a_b" },
      }),
    );

    expect(text).toContain("Catatan: &lt;b&gt;x&lt;/b&gt;");
    expect(text).toContain("A &amp; B");
    expect(text).not.toContain("<b>");
  });
});
