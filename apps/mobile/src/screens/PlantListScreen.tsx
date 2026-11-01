import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { toDateKey } from "@plant-tracker/shared";
import type { RootStackParamList } from "../navigation";
import { supabase } from "../lib/supabase";
import { listSchedule, signedPhotoUrls } from "../lib/plants";
import { Chip, colors, radius, shadow } from "../theme";

interface Row {
  id: string;
  nickname: string;
  species_common: string | null;
  photo_path: string | null;
  location: string | null;
}

type Status = { label: string; tone: "red" | "amber" | "blue" };

export function PlantListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [plants, setPlants] = useState<Row[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, Status[]>>({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data } = await supabase
          .from("plants")
          .select("id, nickname, species_common, photo_path, location")
          .order("created_at", { ascending: false });
        const rows = (data ?? []) as Row[];
        setPlants(rows);
        setPhotos(await signedPhotoUrls(rows.flatMap((r) => (r.photo_path ? [r.photo_path] : []))));
        try {
          const today = toDateKey(new Date());
          const next: Record<string, Status[]> = {};
          for (const t of await listSchedule()) {
            if (!t.due) continue;
            const key = toDateKey(t.due);
            const noun = t.kind === "water" ? "Water" : "Fertilize";
            const tone = t.kind === "water" ? "blue" : "amber";
            if (key < today) (next[t.plantId] ??= []).push({ label: `${noun} overdue`, tone: "red" });
            else if (key === today) (next[t.plantId] ??= []).push({ label: `${noun} today`, tone });
          }
          setStatus(next);
        } catch {
          setStatus({});
        }
      })();
    }, []),
  );

  return (
    <View style={s.container}>
      <FlatList
        data={plants}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>🪴</Text>
            <Text style={s.emptyTitle}>No plants yet</Text>
            <Text style={s.empty}>Tap Add and snap a photo of your first plant.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("PlantDetail", { plantId: item.id })}
          >
            {item.photo_path && photos[item.photo_path] ? (
              <Image source={{ uri: photos[item.photo_path] }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.placeholder]}>
                <Text style={{ fontSize: 34 }}>🌿</Text>
              </View>
            )}
            <View style={s.info}>
              <Text style={s.name} numberOfLines={1}>{item.nickname}</Text>
              {item.species_common ? <Text style={s.species} numberOfLines={1}>{item.species_common}</Text> : null}
              {item.location ? <Text style={s.location} numberOfLines={1}>📍 {item.location}</Text> : null}
              <View style={s.chips}>
                {(status[item.id] ?? []).map((st) => <Chip key={st.label} label={st.label} tone={st.tone} />)}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  emptyBox: { alignItems: "center", marginTop: 80 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 8 },
  empty: { color: colors.muted, marginTop: 4 },
  card: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius, overflow: "hidden", ...shadow },
  photo: { width: 100, height: 112, backgroundColor: colors.leaf },
  placeholder: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, padding: 12, gap: 2, justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  species: { color: colors.primary, fontWeight: "500" },
  location: { color: colors.muted, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
});
