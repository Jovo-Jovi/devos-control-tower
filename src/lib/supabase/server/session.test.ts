import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string): never => {
  throw new Error(`REDIRECT ${path}`);
});
const signOut = vi.fn(async () => ({ error: null }));
const getUser = vi.fn();
const rpc = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser, signOut },
    rpc,
  }),
}));

const { requireOwner } = await import("./session");

describe("U-T01-2 requireOwner", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    redirect.mockClear();
    signOut.mockClear();
    getUser.mockReset();
    rpc.mockReset();
  });

  it("redirects to /sign-in when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireOwner()).rejects.toThrow("REDIRECT /sign-in");
    expect(signOut).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("signs out and redirects when is_owner is false", async () => {
    getUser.mockResolvedValue({
      data: { user: { identities: [] } },
      error: null,
    });
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(requireOwner()).rejects.toThrow("REDIRECT /sign-in?reason=not_owner");
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("returns the GitHub identity login when is_owner is true", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          identities: [
            {
              provider: "github",
              identity_data: {
                user_name: "tower-owner",
                avatar_url: "https://avatars.githubusercontent.com/u/1",
              },
            },
          ],
        },
      },
      error: null,
    });
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(requireOwner()).resolves.toEqual({
      login: "tower-owner",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});
