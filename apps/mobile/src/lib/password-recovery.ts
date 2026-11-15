import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RecoveryAuth = Pick<SupabaseClient["auth"], "resetPasswordForEmail" | "verifyOtp" | "updateUser" | "signOut">;

export class PasswordRecovery {
  private verified = false;

  constructor(private auth: RecoveryAuth) {}

  async sendCode(email: string): Promise<void> {
    const { error } = await this.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async verifyCode(email: string, token: string): Promise<void> {
    const { data, error } = await this.auth.verifyOtp({ email, token, type: "recovery" });
    if (error) throw error;
    if (!data.session) throw new Error("Recovery session not created");
    this.verified = true;
  }

  async updatePassword(password: string): Promise<void> {
    if (!this.verified) throw new Error("Verify the recovery code first");
    const { error } = await this.auth.updateUser({ password });
    if (error) throw error;
    await this.cancel();
  }

  async cancel(): Promise<void> {
    if (!this.verified) return;
    this.verified = false;
    await this.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}

export function createPasswordRecovery(): PasswordRecovery {
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      auth: {
        storageKey: "plant-tracker-password-recovery",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return new PasswordRecovery(client.auth);
}
