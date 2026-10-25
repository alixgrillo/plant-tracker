import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { supabase } from "../lib/supabase";

interface Row {
  id: string;
  nickname: string;
  species_common: string | null;
}

export function PlantListScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "PlantList">) {
  const [plants, setPlants] = useState<Row[]>([]);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from("plants")
        .select("id, nickname, species_common")
        .order("created_at", { ascending: false })
        .then(({ data }) => setPlants(data ?? []));
    }, []),
  );

  return (
    <View style={s.container}>
      <FlatList
        data={plants}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<Text style={s.empty}>No plants yet. Add your first one!</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [s.row, pressed && { backgroundColor: "#f0f0f0" }]}
            onPress={() => navigation.navigate("PlantDetail", { plantId: item.id })}
          >
            <Text style={s.name}>{item.nickname}</Text>
            {item.species_common ? <Text style={s.species}>{item.species_common}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  empty: { textAlign: "center", marginTop: 40, color: "#666" },
  row: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  name: { fontSize: 18, fontWeight: "500", color: "#111" },
  species: { color: "#444" },
});
