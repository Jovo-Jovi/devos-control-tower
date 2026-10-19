import { describe, expect, it } from "vitest";
import { confirmTarget } from "./confirm-target";

describe("confirmTarget", () => {
  it("keeps a plain code", () => {
    expect(confirmTarget("?code=t09-synthetic-code")).toBe("/auth/confirm?code=t09-synthetic-code");
  });

  it("encodes a code that needs encoding", () => {
    expect(confirmTarget("?code=a b")).toBe("/auth/confirm?code=a%20b");
  });

  it("sends a missing code to the auth error", () => {
    expect(confirmTarget("")).toBe("/sign-in?reason=auth_error");
  });

  it("sends an empty code to the auth error", () => {
    expect(confirmTarget("?code=")).toBe("/sign-in?reason=auth_error");
  });

  it("drops every parameter except the code", () => {
    expect(confirmTarget("?next=//elsewhere.invalid&code=abc&redirect_to=/x&error=access_denied")).toBe(
      "/auth/confirm?code=abc",
    );
  });

  it("returns only the confirm path or the auth error", () => {
    const results = [
      confirmTarget("?code=plain"),
      confirmTarget("?code=a b"),
      confirmTarget(""),
      confirmTarget("?code="),
      confirmTarget("?next=//elsewhere.invalid&redirect_to=/x&error=access_denied"),
      confirmTarget("?code=abc&next=//elsewhere.invalid"),
    ];
    for (const result of results) {
      expect(result.startsWith("/auth/confirm?code=") || result === "/sign-in?reason=auth_error").toBe(true);
      expect(result.includes("://")).toBe(false);
    }
  });
});
