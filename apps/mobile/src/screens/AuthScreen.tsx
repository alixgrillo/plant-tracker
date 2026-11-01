import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { AppButton, Card, colors } from "../theme";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const run = async (mode: "in" | "up") => {
    const creds = { email, password };
    const { error } =
      mode === "in" ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    if (error) Alert.alert("Error", error.message);
  };

  return (
    <View style={s.container}>
      <Text style={s.emoji}>🪴</Text>
      <Text style={s.title}>Plant Tracker</Text>
      <Text style={s.tagline}>Know what your plants need, right when they need it.</Text>
      <Card style={s.card}>
        <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} />
        <AppButton title="Sign in" onPress={() => run("in")} />
        <AppButton title="Create account" variant="secondary" onPress={() => run("up")} />
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  emoji: { fontSize: 64, textAlign: "center" },
  title: { fontSize: 32, fontWeight: "800", color: colors.primaryDark, textAlign: "center" },
  tagline: { color: colors.muted, textAlign: "center", marginTop: 4, marginBottom: 24 },
  card: { gap: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: colors.bg },
});
