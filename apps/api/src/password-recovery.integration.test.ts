import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { PasswordRecovery } from "../../mobile/src/lib/password-recovery.js";

describe("Supabase recovery client", () => {
  it("verifies and updates through a temporary session without signing in the main client", async () => {
    const user = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", email: "person@example.com" };
    const session = {
      access_token: "mock-access-token", refresh_token: "mock-refresh-token",
      token_type: "bearer", expires_in: 3600, user,
    };
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/recover")) return Response.json({});
      if (url.pathname.endsWith("/verify")) return Response.json(session);
      if (url.pathname.endsWith("/user") && init?.method === "PUT") return Response.json(user);
      if (url.pathname.endsWith("/logout")) return Response.json({});
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    const auth = {
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    };
    const main = createClient("https://example.test", "public-key", {
      auth: { ...auth, storageKey: "main" }, global: { fetch },
    });
    const temporary = createClient("https://example.test", "public-key", {
      auth: { ...auth, storageKey: "recovery" }, global: { fetch },
    });
    const recovery = new PasswordRecovery(temporary.auth);
    await recovery.sendCode("person@example.com");
    await recovery.verifyCode("person@example.com", "123456");
    expect((await temporary.auth.getSession()).data.session?.access_token).toBe("mock-access-token");
    expect((await main.auth.getSession()).data.session).toBeNull();
    await recovery.updatePassword("a-new-password");
    expect((await temporary.auth.getSession()).data.session).toBeNull();
    expect((await main.auth.getSession()).data.session).toBeNull();
    const calls = fetch.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(calls).toEqual(["/auth/v1/recover", "/auth/v1/verify", "/auth/v1/user", "/auth/v1/logout"]);
  });
});
