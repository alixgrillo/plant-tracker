import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { careEditSchema } from "@plant-tracker/shared";
import type { RootStackParamList } from "../navigation";
import { getPlant, saveCare, updatePlant } from "../lib/plants";

type Props = NativeStackScreenProps<RootStackParamList, "EditPlant">;

export function EditPlantScreen({ route, navigation }: Props) {
  const { plantId } = route.params;
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nickname: "", location: "", notes: "", description: "", light: "",
    min: "", max: "", waterNotes: "", healthSigns: "",
  });
  const [hadCare, setHadCare] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    getPlant(plantId)
      .then((p) => {
        setHadCare(!!p.care);
        setF({
          nickname: p.nickname,
          location: p.location ?? "",
          notes: p.notes ?? "",
          description: p.care?.description ?? "",
          light: p.care?.light ?? "",
          min: p.care?.water_min_days?.toString() ?? "",
          max: p.care?.water_max_days?.toString() ?? "",
          waterNotes: p.care?.water_notes ?? "",
          healthSigns: p.care?.health_signs ?? "",
        });
        setLoaded(true);
      })
      .catch((e) => Alert.alert("Could not load plant", String(e)));
  }, [plantId]);

  const save = async () => {
    if (!f.nickname.trim()) return Alert.alert("Name is required");
    const wantsCare = hadCare || f.min || f.max || f.light || f.description || f.waterNotes || f.healthSigns;
    let care;
    if (wantsCare) {
      const parsed = careEditSchema.safeParse({
        description: f.description,
        light: f.light,
        waterMinDays: Number(f.min),
        waterMaxDays: Number(f.max),
        waterNotes: f.waterNotes,
        healthSigns: f.healthSigns,
      });
      if (!parsed.success) {
        return Alert.alert("Check watering days", parsed.error.issues[0]?.message ?? "Invalid values");
      }
      care = parsed.data;
    }
    setSaving(true);
    try {
      await updatePlant(plantId, {
        nickname: f.nickname.trim(),
        location: f.location.trim() || null,
        notes: f.notes.trim() || null,
      });
      if (care) await saveCare(plantId, care, "manual");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Label t="Name" /><TextInput style={s.input} value={f.nickname} onChangeText={set("nickname")} />
      <Label t="Location" /><TextInput style={s.input} value={f.location} onChangeText={set("location")} placeholder="e.g. Kitchen window" placeholderTextColor="#888" />
      <Label t="Notes" /><TextInput style={[s.input, s.multi]} multiline value={f.notes} onChangeText={set("notes")} />
      <Text style={s.section}>Care info</Text>
      <Label t="About" /><TextInput style={[s.input, s.multi]} multiline value={f.description} onChangeText={set("description")} />
      <Label t="Light" /><TextInput style={[s.input, s.multi]} multiline value={f.light} onChangeText={set("light")} />
      <Label t="Water every (min days)" /><TextInput style={s.input} keyboardType="number-pad" value={f.min} onChangeText={set("min")} />
      <Label t="Water every (max days)" /><TextInput style={s.input} keyboardType="number-pad" value={f.max} onChangeText={set("max")} />
      <Label t="Watering notes" /><TextInput style={[s.input, s.multi]} multiline value={f.waterNotes} onChangeText={set("waterNotes")} />
      <Label t="Healthy signs" /><TextInput style={[s.input, s.multi]} multiline value={f.healthSigns} onChangeText={set("healthSigns")} />
      <Button title={saving ? "Saving..." : "Save"} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const Label = ({ t }: { t: string }) => <Text style={s.label}>{t}</Text>;

const s = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 6 },
  section: { fontSize: 18, fontWeight: "600", marginTop: 16, color: "#111" },
  label: { fontWeight: "600", color: "#333", marginTop: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, color: "#111" },
  multi: { minHeight: 64, textAlignVertical: "top" },
});
