import { useCallback, useEffect, useState } from "react";
import { Button, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

interface Row {
  id: string;
  nickname: string;
  species_common: string | null;
}

export function PlantListScreen({ onAdd }: { onAdd: () => void }) {
  const [plants, setPlants] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("plants")
      .select("id, nickname, species_common")
      .order("created_at", { ascending: false });
    setPlants(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={s.container}>
      <FlatList
        data={plants}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<Text style={s.empty}>No plants yet. Add your first one!</Text>}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.name}>{item.nickname}</Text>
            {item.species_common ? <Text>{item.species_common}</Text> : null}
          </View>
        )}
      />
      <Button title="Add plant" onPress={onAdd} />
      <View style={{ height: 8 }} />
      <Button title="Sign out" color="#888" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 56 },
  empty: { textAlign: "center", marginTop: 40, color: "#666" },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  name: { fontSize: 18, fontWeight: "500" },
});
