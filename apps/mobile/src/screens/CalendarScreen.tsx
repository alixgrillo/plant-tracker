import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Button, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { toDateKey } from "@plant-tracker/shared";
import type { RootStackParamList } from "../navigation";
import { listSchedule, markWatered, type ScheduleItem } from "../lib/plants";

const DAY_MS = 24 * 60 * 60 * 1000;

export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [selected, setSelected] = useState(toDateKey(new Date()));

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

  const watered = async (id: string) => {
    try {
      await markWatered(id);
      await load();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : String(e));
    }
  };

  const { overdue, today, week, byDay, marked, noSchedule } = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const weekEnd = toDateKey(new Date(Date.now() + 7 * DAY_MS));
    const scheduled = (items ?? []).filter((i) => i.due);
    const keyOf = (i: ScheduleItem) => toDateKey(i.due!);
    const byDay: Record<string, ScheduleItem[]> = {};
    for (const i of scheduled) (byDay[keyOf(i)] ??= []).push(i);
    const marked: Record<string, object> = {};
    for (const [day, list] of Object.entries(byDay)) {
      marked[day] = { marked: true, dotColor: day < todayKey ? "#c0392b" : "#2e8b57", count: list.length };
    }
    marked[selected] = { ...(marked[selected] ?? {}), selected: true, selectedColor: "#2e8b57" };
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
    <View style={s.row}>
      <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("PlantDetail", { plantId: item.id })}>
        <Text style={s.name}>{item.nickname}</Text>
        <Text style={s.sub}>
          {item.species_common ? `${item.species_common} · ` : ""}
          {showDate && item.due ? `due ${item.due.toLocaleDateString()}` : ""}
        </Text>
      </Pressable>
      <Button title="Watered" onPress={() => watered(item.id)} />
    </View>
  );

  const Section = ({ title, list, showDate }: { title: string; list: ScheduleItem[]; showDate?: boolean }) =>
    list.length ? (
      <View>
        <Text style={s.section}>{title} ({list.length})</Text>
        {list.map((i) => <Row key={i.id} item={i} showDate={showDate} />)}
      </View>
    ) : null;

  return (
    <ScrollView style={s.container}>
      <Calendar
        markedDates={marked}
        onDayPress={(d) => setSelected(d.dateString)}
        theme={{ todayTextColor: "#2e8b57", arrowColor: "#2e8b57" }}
      />
      <Section title={`Plants due ${selected}`} list={byDay[selected] ?? []} />
      {!byDay[selected]?.length && <Text style={s.empty}>Nothing due on {selected}.</Text>}
      <Section title="Overdue" list={overdue} showDate />
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
  container: { flex: 1, backgroundColor: "#fff" },
  section: { fontSize: 16, fontWeight: "600", color: "#111", marginTop: 16, marginHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  name: { fontSize: 16, color: "#111" },
  sub: { color: "#555" },
  empty: { margin: 16, color: "#666" },
});
