import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createPasswordRecovery, PasswordRecovery } from "../../mobile/src/lib/password-recovery.js";

function makeAuth() {
  return {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { session: { access_token: "test" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
}

beforeEach(() => createClient.mockReset());

describe("password recovery", () => {
  it("uses a separate, nonpersistent client so recovery does not change the main session", () => {
    const auth = makeAuth();
    createClient.mockReturnValue({ auth });
    expect(createPasswordRecovery()).toBeInstanceOf(PasswordRecovery);
    expect(createClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      auth: {
        storageKey: "plant-tracker-password-recovery",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  });

  it("requests and verifies a recovery code before changing the password", async () => {
    const auth = makeAuth();
    const recovery = new PasswordRecovery(auth as unknown as ConstructorParameters<typeof PasswordRecovery>[0]);
    await expect(recovery.updatePassword("new-password")).rejects.toThrow("Verify");
    await recovery.sendCode("person@example.com");
    await recovery.verifyCode("person@example.com", "123456");
    await recovery.updatePassword("new-password");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("person@example.com");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "person@example.com", token: "123456", type: "recovery" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    await expect(recovery.updatePassword("another-password")).rejects.toThrow("Verify");
  });

  it("does not allow an invalid or expired code to update a password", async () => {
    const auth = makeAuth();
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: new Error("invalid code") });
    const recovery = new PasswordRecovery(auth as unknown as ConstructorParameters<typeof PasswordRecovery>[0]);
    await expect(recovery.verifyCode("person@example.com", "000000")).rejects.toThrow("invalid code");
    await expect(recovery.updatePassword("new-password")).rejects.toThrow("Verify");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a verification response without a recovery session", async () => {
    const auth = makeAuth();
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    const recovery = new PasswordRecovery(auth as unknown as ConstructorParameters<typeof PasswordRecovery>[0]);
    await expect(recovery.verifyCode("person@example.com", "123456")).rejects.toThrow("session");
    await expect(recovery.updatePassword("new-password")).rejects.toThrow("Verify");
  });

  it("keeps the verified session for a retry if password update fails", async () => {
    const auth = makeAuth();
    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("weak password") });
    const recovery = new PasswordRecovery(auth as unknown as ConstructorParameters<typeof PasswordRecovery>[0]);
    await recovery.verifyCode("person@example.com", "123456");
    await expect(recovery.updatePassword("weak")).rejects.toThrow("weak password");
    expect(auth.signOut).not.toHaveBeenCalled();
    await recovery.updatePassword("stronger-password");
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(auth.updateUser).toHaveBeenCalledTimes(2);
  });

  it("ends only the temporary recovery session when cancelled", async () => {
    const auth = makeAuth();
    const recovery = new PasswordRecovery(auth as unknown as ConstructorParameters<typeof PasswordRecovery>[0]);
    await recovery.verifyCode("person@example.com", "123456");
    await recovery.cancel();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    await expect(recovery.updatePassword("new-password")).rejects.toThrow("Verify");
  });
});
