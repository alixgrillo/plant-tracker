import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { careEditSchema } from "@plant-tracker/shared";
import type { RootStackParamList } from "../navigation";
import { AppButton, colors } from "../theme";
import { getPlant, saveCare, updatePlant } from "../lib/plants";

type Props = NativeStackScreenProps<RootStackParamList, "EditPlant">;

export function EditPlantScreen({ route, navigation }: Props) {
  const { plantId } = route.params;
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nickname: "", location: "", notes: "", description: "", light: "",
    interval: "", min: "", max: "", waterNotes: "", waterHow: "",
    fertilizerEveryDays: "", fertilizerNotes: "", fertilizerType: "", selfWateringPotRecommendation: "depends" as "recommended" | "not_recommended" | "depends",
    selfWateringPotNotes: "", healthSigns: "",
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
          interval: p.water_interval_override?.toString() ?? "",
          min: p.care?.water_min_days?.toString() ?? "",
          max: p.care?.water_max_days?.toString() ?? "",
          waterNotes: p.care?.water_notes ?? "",
          waterHow: p.care?.water_how ?? "",
          fertilizerEveryDays: p.care?.fertilizer_every_days?.toString() ?? "",
          fertilizerNotes: p.care?.fertilizer_notes ?? "",
          fertilizerType: p.care?.fertilizer_type ?? "",
          selfWateringPotRecommendation: p.care?.self_watering_pot_recommendation ?? "depends",
          selfWateringPotNotes: p.care?.self_watering_pot_notes ?? "",
          healthSigns: p.care?.health_signs ?? "",
        });
        setLoaded(true);
      })
      .catch((e) => Alert.alert("Could not load plant", String(e)));
  }, [plantId]);

  const save = async () => {
    if (!f.nickname.trim()) return Alert.alert("Name is required");
    const wantsCare = hadCare || f.min || f.max || f.light || f.description || f.waterNotes || f.healthSigns || f.fertilizerEveryDays || f.fertilizerNotes || f.selfWateringPotNotes;
    let care;
    if (wantsCare) {
      const parsed = careEditSchema.safeParse({
        description: f.description,
        light: f.light,
        waterMinDays: Number(f.min),
        waterMaxDays: Number(f.max),
        waterNotes: f.waterNotes,
        waterHow: f.waterHow,
        fertilizerEveryDays: f.fertilizerEveryDays.trim() ? Number(f.fertilizerEveryDays) : null,
        fertilizerNotes: f.fertilizerNotes,
        fertilizerType: f.fertilizerType,
        selfWateringPotRecommendation: f.selfWateringPotRecommendation,
        selfWateringPotNotes: f.selfWateringPotNotes,
        healthSigns: f.healthSigns,
      });
      if (!parsed.success) {
        return Alert.alert("Check watering days", parsed.error.issues[0]?.message ?? "Invalid values");
      }
      care = parsed.data;
    }
    const interval = f.interval.trim() ? Number(f.interval) : null;
    if (interval !== null && (!Number.isInteger(interval) || interval < 1)) {
      return Alert.alert("Watering interval must be a whole number of days");
    }
    setSaving(true);
    try {
      await updatePlant(plantId, {
        nickname: f.nickname.trim(),
        location: f.location.trim() || null,
        notes: f.notes.trim() || null,
        water_interval_override: interval,
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
      <Label t="Watering interval override (days, optional)" /><TextInput style={s.input} keyboardType="number-pad" value={f.interval} onChangeText={set("interval")} placeholder="Leave blank to use the AI range" placeholderTextColor="#888" />
      <Text style={s.section}>Care info</Text>
      <Label t="About" /><TextInput style={[s.input, s.multi]} multiline value={f.description} onChangeText={set("description")} />
      <Label t="Light" /><TextInput style={[s.input, s.multi]} multiline value={f.light} onChangeText={set("light")} />
      <Label t="Water every (min days)" /><TextInput style={s.input} keyboardType="number-pad" value={f.min} onChangeText={set("min")} />
      <Label t="Water every (max days)" /><TextInput style={s.input} keyboardType="number-pad" value={f.max} onChangeText={set("max")} />
      <Label t="Watering notes" /><TextInput style={[s.input, s.multi]} multiline value={f.waterNotes} onChangeText={set("waterNotes")} />
      <Label t="How to water" /><TextInput style={[s.input, s.multi]} multiline value={f.waterHow} onChangeText={set("waterHow")} />
      <Label t="Fertilize every (days, optional)" /><TextInput style={s.input} keyboardType="number-pad" value={f.fertilizerEveryDays} onChangeText={set("fertilizerEveryDays")} placeholder="Leave blank if no schedule" placeholderTextColor="#888" />
      <Label t="Fertilizer type to keep on hand" /><TextInput style={s.input} value={f.fertilizerType} onChangeText={set("fertilizerType")} placeholder="e.g. Balanced liquid houseplant fertilizer" placeholderTextColor="#888" />
      <Label t="Fertilizer notes" /><TextInput style={[s.input, s.multi]} multiline value={f.fertilizerNotes} onChangeText={set("fertilizerNotes")} />
      <Label t="Self-watering pot recommendation" />
      <AppButton
        variant="secondary"
        title={`Recommendation: ${f.selfWateringPotRecommendation.replace("_", " ")}`}
        onPress={() => setF((p) => ({
          ...p,
          selfWateringPotRecommendation:
            p.selfWateringPotRecommendation === "recommended" ? "not_recommended" :
            p.selfWateringPotRecommendation === "not_recommended" ? "depends" : "recommended",
        }))}
      />
      <TextInput style={[s.input, s.multi]} multiline value={f.selfWateringPotNotes} onChangeText={set("selfWateringPotNotes")} placeholder="Why this pot type does or does not suit the plant" placeholderTextColor="#888" />
      <Label t="Healthy signs" /><TextInput style={[s.input, s.multi]} multiline value={f.healthSigns} onChangeText={set("healthSigns")} />
      <AppButton title={saving ? "Saving..." : "Save"} onPress={save} disabled={saving} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const Label = ({ t }: { t: string }) => <Text style={s.label}>{t}</Text>;

const s = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 6 },
  section: { fontSize: 20, fontWeight: "800", marginTop: 20, color: colors.text },
  label: { fontWeight: "700", color: colors.primaryDark, marginTop: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: colors.card },
  multi: { minHeight: 64, textAlignVertical: "top" },
});







