import { describe, expect, it } from "vitest";
import { nextUsernameChangeAt, usernameError } from "./username";

describe("usernameError", () => {
  it("accepts letters, numbers and underscores, 3-20 chars", () => {
    expect(usernameError("ross")).toBeNull();
    expect(usernameError("Ross_Mackenzie_99")).toBeNull();
    expect(usernameError("abc")).toBeNull();
    expect(usernameError("a".repeat(20))).toBeNull();
  });

  it("rejects bad lengths and characters", () => {
    expect(usernameError("ab")).toMatch(/at least 3/);
    expect(usernameError("a".repeat(21))).toMatch(/at most 20/);
    expect(usernameError("ross m")).toMatch(/letters, numbers/);
    expect(usernameError("ross-m")).toMatch(/letters, numbers/);
    expect(usernameError("rößl")).toMatch(/letters, numbers/);
  });

  it("rejects reserved names in any case", () => {
    expect(usernameError("admin")).toMatch(/reserved/);
    expect(usernameError("ADMIN")).toMatch(/reserved/);
    expect(usernameError("Support")).toMatch(/reserved/);
  });
});

describe("nextUsernameChangeAt", () => {
  it("is 30 days later", () => {
    const t = new Date("2026-01-01T00:00:00Z");
    expect(nextUsernameChangeAt(t).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});
