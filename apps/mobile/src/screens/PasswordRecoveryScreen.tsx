import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { createPasswordRecovery } from "../lib/password-recovery";
import { AppButton, Card, colors } from "../theme";

export function PasswordRecoveryScreen({ onExit }: { onExit: () => void }) {
  const [recovery] = useState(createPasswordRecovery);
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => () => {
    void recovery.cancel();
  }, [recovery]);

  const run = async (action: () => Promise<void>, failure: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert("Password reset", failure);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const send = () => {
    const address = email.trim();
    if (!address) return Alert.alert("Email required", "Enter your account email.");
    setEmail(address);
    return run(async () => {
      await recovery.sendCode(address);
      setCode("");
      setStep("code");
    }, "Could not request a reset code. Please try again later.");
  };

  const verify = () => {
    const token = code.trim();
    if (!token) return Alert.alert("Code required", "Enter the code from your email.");
    return run(async () => {
      await recovery.verifyCode(email, token);
      setCode("");
      setStep("password");
    }, "Could not verify the code. Check it or request a new one.");
  };

  const update = () => {
    if (password.length < 6) return Alert.alert("Password too short", "Use at least 6 characters.");
    if (password !== confirmation) return Alert.alert("Passwords do not match");
    return run(async () => {
      await recovery.updatePassword(password);
      Alert.alert("Password updated", "You can now sign in with your new password.");
      onExit();
    }, "Could not update the password. Check your password requirements and try again.");
  };

  const exit = () => run(async () => {
    await recovery.cancel();
    onExit();
  }, "Could not leave password recovery. Please try again.");

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Reset password</Text>
      <Card style={s.card}>
        {step === "email" ? (
          <>
            <Text style={s.text}>Enter your account email to request a reset code.</Text>
            <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
              value={email} onChangeText={setEmail} editable={!busy} />
            <AppButton title="Send reset code" onPress={send} disabled={busy} />
          </>
        ) : step === "code" ? (
          <>
            <Text style={s.text}>If an account exists for {email}, a reset code has been emailed. Enter it below.</Text>
            <TextInput style={s.input} placeholder="Reset code" placeholderTextColor={colors.muted}
              keyboardType="number-pad" autoComplete="one-time-code" value={code}
              onChangeText={setCode} editable={!busy} />
            <AppButton title="Verify code" onPress={verify} disabled={busy} />
            <AppButton title="Request a new code" variant="secondary" onPress={send} disabled={busy} />
            <AppButton title="Change email" variant="secondary" onPress={() => setStep("email")} disabled={busy} />
          </>
        ) : (
          <>
            <Text style={s.text}>Choose a new password.</Text>
            <TextInput style={s.input} placeholder="New password" placeholderTextColor={colors.muted}
              secureTextEntry autoCapitalize="none" autoComplete="new-password" value={password}
              onChangeText={setPassword} editable={!busy} />
            <TextInput style={s.input} placeholder="Confirm new password" placeholderTextColor={colors.muted}
              secureTextEntry autoCapitalize="none" autoComplete="new-password" value={confirmation}
              onChangeText={setConfirmation} editable={!busy} />
            <AppButton title="Update password" onPress={update} disabled={busy} />
          </>
        )}
        <AppButton title="Back to sign in" variant="secondary" onPress={exit} disabled={busy} />
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "800", color: colors.primaryDark, textAlign: "center", marginBottom: 24 },
  card: { gap: 12 },
  text: { color: colors.text, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: colors.bg },
});
