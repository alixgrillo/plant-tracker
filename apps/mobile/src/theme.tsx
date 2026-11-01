import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export const colors = {
  bg: "#f6f3ea",
  card: "#ffffff",
  primary: "#2e7d4f",
  primaryDark: "#1f5c39",
  leaf: "#e3f0e6",
  text: "#1d2b22",
  muted: "#6b7a70",
  border: "#e4dfd0",
  water: "#3b82c4",
  fertilizer: "#d9902f",
  danger: "#c0392b",
  dangerBg: "#fdecea",
  warnBg: "#fff4dc",
};

export const radius = 16;

export const shadow = {
  shadowColor: "#1d2b22",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = "primary" | "secondary" | "danger" | "warn";

const variantStyles: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: "#fff" },
  secondary: { bg: colors.leaf, fg: colors.primaryDark },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  warn: { bg: colors.warnBg, fg: "#9a6212" },
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variantStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        { backgroundColor: v.bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[s.buttonText, small && s.buttonTextSmall, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, tone = "green" }: { label: string; tone?: "green" | "red" | "amber" | "blue" }) {
  const tones = {
    green: { bg: colors.leaf, fg: colors.primaryDark },
    red: { bg: colors.dangerBg, fg: colors.danger },
    amber: { bg: colors.warnBg, fg: "#9a6212" },
    blue: { bg: "#e4effa", fg: "#235d91" },
  }[tone];
  return (
    <View style={[s.chip, { backgroundColor: tones.bg }]}>
      <Text style={[s.chipText, { color: tones.fg }]}>{label}</Text>
    </View>
  );
}

export const headerOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.primaryDark,
  headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 16, ...shadow },
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center" },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  buttonTextSmall: { fontSize: 14 },
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  chipText: { fontSize: 12, fontWeight: "700" },
});
