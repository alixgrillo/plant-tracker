import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { toDateKey } from "@plant-tracker/shared";
import type { RootStackParamList } from "../navigation";
import { syncReminders } from "../lib/reminders";
import { listSchedule, markFertilized, markWatered, type ScheduleItem } from "../lib/plants";
import { AppButton, Card, colors } from "../theme";

export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [selected, setSelected] = useState(toDateKey(new Date()));
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setItems(await listSchedule());
    } catch (e) {
      Alert.alert("Could not load schedule", e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const completed = async (item: ScheduleItem) => {
    if (pendingRef.current.has(item.id)) return;
    pendingRef.current.add(item.id);
    setPending(new Set(pendingRef.current));
    try {
      if (item.kind === "water") await markWatered(item.plantId);
      else await markFertilized(item.plantId);
      await load();
      void syncReminders().catch(() => undefined);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : String(e));
    } finally {
      pendingRef.current.delete(item.id);
      setPending(new Set(pendingRef.current));
    }
  };

  const { overdue, today, week, byDay, marked, noSchedule } = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const weekEnd = toDateKey(end);
    const scheduled = (items ?? []).filter((i) => i.due);
    const keyOf = (i: ScheduleItem) => toDateKey(i.due!);
    const byDay: Record<string, ScheduleItem[]> = {};
    for (const i of scheduled) (byDay[keyOf(i)] ??= []).push(i);
    const marked: Record<string, object> = {};
    for (const [day, list] of Object.entries(byDay)) {
      const dots = [
        ...(list.some((i) => i.kind === "water") ? [{ key: "water", color: day < todayKey ? colors.danger : colors.water }] : []),
        ...(list.some((i) => i.kind === "fertilizer") ? [{ key: "fertilizer", color: day < todayKey ? colors.danger : colors.fertilizer }] : []),
      ];
      marked[day] = { dots };
    }
    marked[selected] = { ...(marked[selected] ?? {}), selected: true, selectedColor: colors.primary };
    return {
      overdue: scheduled.filter((i) => keyOf(i) < todayKey),
      today: scheduled.filter((i) => keyOf(i) === todayKey),
      week: scheduled.filter((i) => keyOf(i) > todayKey && keyOf(i) <= weekEnd),
      byDay,
      marked,
      noSchedule: (items ?? []).filter((i) => !i.due),
    };
  }, [items, selected]);

  if (!items) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const Row = ({ item, showDate }: { item: ScheduleItem; showDate?: boolean }) => (
    <Card style={s.row}>
      <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("PlantDetail", { plantId: item.plantId })}>
        <Text style={s.name}>{item.kind === "water" ? "💧" : "🌱"} {item.nickname}</Text>
        <Text style={s.sub}>
          {item.kind === "water" ? "Water" : "Fertilize"}
          {item.species_common ? ` · ${item.species_common}` : ""}
          {showDate && item.due ? ` · due ${item.due.toLocaleDateString()}` : ""}
        </Text>
      </Pressable>
      <AppButton
        small
        variant={item.kind === "water" ? "primary" : "secondary"}
        title={item.kind === "water" ? "✓ Watered" : "✓ Fertilized"}
        onPress={() => completed(item)}
        disabled={pending.has(item.id)}
      />
    </Card>
  );

  const Section = ({ title, list, showDate }: { title: string; list: ScheduleItem[]; showDate?: boolean }) =>
    list.length ? (
      <View style={s.group}>
        <Text style={s.section}>{title} ({list.length})</Text>
        {list.map((i) => <Row key={i.id} item={i} showDate={showDate} />)}
      </View>
    ) : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Card style={s.calendarCard}>
        <Calendar
          markingType="multi-dot"
          markedDates={marked}
          onDayPress={(d) => setSelected(d.dateString)}
          theme={{
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            selectedDayBackgroundColor: colors.primary,
            monthTextColor: colors.text,
            textMonthFontWeight: "700",
          }}
        />
        <View style={s.legend}>
          <Text style={[s.legendItem, { color: colors.water }]}>● Water</Text>
          <Text style={[s.legendItem, { color: colors.fertilizer }]}>● Fertilize</Text>
          <Text style={[s.legendItem, { color: colors.danger }]}>● Overdue</Text>
        </View>
      </Card>
      <Section title={`Plants due ${selected}`} list={byDay[selected] ?? []} />
      {!byDay[selected]?.length && <Text style={s.empty}>Nothing due on {selected}. 🌤️</Text>}
      <Section title="⚠️ Overdue" list={overdue} showDate />
      <Section title="Today" list={today} />
      <Section title="This week" list={week} showDate />
      {noSchedule.length > 0 && (
        <Text style={s.empty}>
          {noSchedule.length} plant(s) have no watering info yet: {noSchedule.map((p) => p.nickname).join(", ")}
        </Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  calendarCard: { margin: 16, padding: 8 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 6 },
  legendItem: { fontSize: 12, fontWeight: "600" },
  group: { gap: 8 },
  section: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 12, marginHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, padding: 12, gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { color: colors.muted },
  empty: { margin: 16, color: colors.muted },
});
