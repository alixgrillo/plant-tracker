import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { LightCategory, PlantSummary, SummaryPlant } from "@plant-tracker/shared";
import { loadSummary } from "../lib/plants";
import type { RootStackParamList } from "../navigation";
import { Card, colors } from "../theme";

const LIGHT_LABELS: [LightCategory, string, string][] = [
  ["low", "🌑 Low light", "#7a8f9e"],
  ["medium", "⛅ Medium light", "#8fbf7a"],
  ["bright", "🌤️ Bright indirect", "#e0b43c"],
  ["direct", "☀️ Direct sun", "#e07a3c"],
  ["unknown", "❔ Not specified", "#b9b3a0"],
];

export function SummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [summary, setSummary] = useState<PlantSummary | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const plantList = (plants: SummaryPlant[], showLight = false) => (
    <View style={s.plantList}>
      {plants.map((plant) => (
        <Pressable key={plant.id} accessibilityRole="button"
          accessibilityLabel={`Open ${plant.nickname}`}
          onPress={() => navigation.navigate("PlantDetail", { plantId: plant.id })}
          style={({ pressed }) => [s.plantRow, pressed && { opacity: 0.6 }]}>
          <Text style={s.plantName}>{plant.nickname}</Text>
          {showLight && plant.light?.trim() ? <Text style={s.plantDetail}>{plant.light}</Text> : null}
        </Pressable>
      ))}
    </View>
  );

  useFocusEffect(
    useCallback(() => {
      loadSummary()
        .then(setSummary)
        .catch((e) => {
          Alert.alert("Could not load summary", e instanceof Error ? e.message : String(e));
        });
    }, []),
  );

  if (!summary) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const { overdue } = summary;
  const hasOverdue = overdue.plants > 0;
  const maxLight = Math.max(1, ...Object.values(summary.byLight));
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.tiles}>
        <View style={[s.tile, { backgroundColor: colors.leaf }]}>
          <Text style={s.big}>{summary.total}</Text>
          <Text style={s.sub}>🪴 Plants registered</Text>
        </View>
        <View style={[s.tile, { backgroundColor: hasOverdue ? colors.dangerBg : colors.leaf }]}>
          <Text style={[s.big, hasOverdue && { color: colors.danger }]}>{overdue.plants}</Text>
          <Text style={s.sub}>{hasOverdue ? "⚠️ Plants overdue" : "✅ Plants overdue"}</Text>
        </View>
      </View>
      {hasOverdue ? (
        <Text style={s.muted}>
          {overdue.watering} overdue watering{overdue.watering === 1 ? "" : "s"}, {overdue.fertilizing} overdue
          fertilizing
        </Text>
      ) : summary.total > 0 ? (
        <Text style={s.muted}>Everything is on schedule. Nice work! 🌱</Text>
      ) : null}

      <Text style={s.section}>Light preference</Text>
      <Card style={{ gap: 12 }}>
        {summary.total === 0 ? <Text style={s.muted}>No plants yet.</Text> : null}
        {LIGHT_LABELS.filter(([k]) => summary.byLight[k] > 0).map(([k, label, color]) => (
          <View key={k}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded.has(`light:${k}`) }}
              accessibilityLabel={`${label}, ${summary.byLight[k]} plants`}
              onPress={() => toggle(`light:${k}`)}>
              <View style={s.barHead}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={s.rowValue}>{summary.byLight[k]} {expanded.has(`light:${k}`) ? "▴" : "▾"}</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { backgroundColor: color, width: `${(summary.byLight[k] / maxLight) * 100}%` }]} />
              </View>
            </Pressable>
            {expanded.has(`light:${k}`) ? plantList(summary.plantsByLight[k], true) : null}
          </View>
        ))}
      </Card>

      <Text style={s.section}>Fertilizers to keep on hand</Text>
      <Card>
        {summary.fertilizers.length ? (
          summary.fertilizers.map((f, i) => (
            <View key={f.type} style={i > 0 && s.rowBorder}>
              <Pressable style={s.row} accessibilityRole="button"
                accessibilityState={{ expanded: expanded.has(`fertilizer:${f.type.toLowerCase()}`) }}
                accessibilityLabel={`${f.type}, ${f.count} plants`}
                onPress={() => toggle(`fertilizer:${f.type.toLowerCase()}`)}>
                <Text style={s.rowLabel}>🧴 {f.type}</Text>
                <Text style={s.rowValue}>{f.count} plant{f.count === 1 ? "" : "s"} {expanded.has(`fertilizer:${f.type.toLowerCase()}`) ? "▴" : "▾"}</Text>
              </Pressable>
              {expanded.has(`fertilizer:${f.type.toLowerCase()}`) ? plantList(f.plants) : null}
            </View>
          ))
        ) : (
          <Text style={s.muted}>
            None yet. Plants added before this feature need "Re-identify with AI" to get a fertilizer suggestion.
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  big: { fontSize: 40, fontWeight: "800", color: colors.primary },
  sub: { color: colors.muted, marginTop: 2, fontWeight: "600" },
  muted: { color: colors.muted, marginTop: 8 },
  section: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 24, marginBottom: 8 },
  barHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.leaf, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowLabel: { flex: 1, color: colors.text, paddingRight: 12 },
  rowValue: { color: colors.primaryDark, fontWeight: "700" },
  plantList: { marginTop: 6, marginBottom: 4 },
  plantRow: { paddingVertical: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.leaf },
  plantName: { color: colors.primaryDark, fontWeight: "600" },
  plantDetail: { color: colors.muted, marginTop: 2 },
});
