import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { identifyPlant } from "../lib/api";
import { nextWaterDue, wateringIntervalDays } from "@plant-tracker/shared";
import { applyIdentification, deletePlant, getPlant, markWatered, type PlantDetail } from "../lib/plants";

type Props = NativeStackScreenProps<RootStackParamList, "PlantDetail">;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function PlantDetailScreen({ route, navigation }: Props) {
  const { plantId } = route.params;
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlant(await getPlant(plantId));
      setError(null);
    } catch (e) {
      setError(msg(e));
    }
  }, [plantId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert("Something went wrong", msg(e));
    } finally {
      setBusy(false);
    }
  };

  const watered = () =>
    run(async () => {
      await markWatered(plantId);
      await load();
    });

  const reidentify = () =>
    run(async () => {
      if (!plant) return;
      const r = await identifyPlant(
        plant.photo_path ? { imagePath: plant.photo_path } : { name: plant.nickname },
      );
      Alert.alert(
        "Update with AI result?",
        `${r.commonName} (${r.confidence} confidence)\n\nThis replaces the current species and care info.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Update",
            onPress: () =>
              run(async () => {
                await applyIdentification(plantId, r);
                await load();
              }),
          },
        ],
      );
    });

  const remove = () =>
    Alert.alert("Delete plant?", `"${plant?.nickname}" and its care info will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          run(async () => {
            await deletePlant(plantId, plant?.photo_path ?? null);
            navigation.goBack();
          }),
      },
    ]);

  if (error) return <Text style={s.error}>{error}</Text>;
  if (!plant) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const c = plant.care;
  const careInput = c ? { waterMinDays: c.water_min_days, waterMaxDays: c.water_max_days } : null;
  const interval = wateringIntervalDays(careInput, plant.water_interval_override);
  const due = nextWaterDue(
    plant.lastWatered ? new Date(plant.lastWatered) : null,
    new Date(plant.created_at),
    careInput,
    plant.water_interval_override,
  );
  const unsure = c?.source === "ai" && c.ai_confidence && c.ai_confidence !== "high";
  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>{plant.nickname}</Text>
      {plant.species_common ? <Text style={s.species}>{plant.species_common}</Text> : null}
      {plant.species_scientific ? <Text style={s.italic}>{plant.species_scientific}</Text> : null}
      {unsure ? (
        <Text style={s.warn}>
          {c!.ai_confidence} confidence - double-check this species. Tap "Wrong plant?" below if it looks off.
        </Text>
      ) : null}
      <Text style={s.muted}>Added {new Date(plant.created_at).toLocaleDateString()}</Text>
      {plant.location ? <Field label="Location" value={plant.location} /> : null}
      {plant.notes ? <Field label="Notes" value={plant.notes} /> : null}

      <Text style={s.section}>Care info{c ? ` (${c.source === "ai" ? "AI suggested" : "edited by you"})` : ""}</Text>
      {c ? (
        <>
          <Field label="About" value={c.description} />
          <Field label="Light" value={c.light} />
          <Field
            label="Watering"
            value={`Every ${c.water_min_days ?? "?"}-${c.water_max_days ?? "?"} days${c.water_notes ? `\n${c.water_notes}` : ""}`}
          />
          <Field label="How to water" value={c.water_how} />
          <Field label="Healthy signs" value={c.health_signs} />
        </>
      ) : (
        <Text style={s.muted}>No care info yet. Try "Re-identify with AI".</Text>
      )}

      <Field
        label="Next watering"
        value={due ? `${due.toLocaleDateString()} (every ${interval} days${plant.water_interval_override ? ", your setting" : ""})` : "Add care info or a watering interval to see this"}
      />
      <Field
        label="Last watered"
        value={plant.lastWatered ? new Date(plant.lastWatered).toLocaleString() : "Not recorded yet"}
      />
      {busy && <ActivityIndicator style={{ margin: 8 }} />}
      <View style={s.buttons}>
        <Button title="Mark as watered" onPress={watered} disabled={busy} />
        <Button title="Edit" onPress={() => navigation.navigate("EditPlant", { plantId })} disabled={busy} />
        <Button title="Re-identify with AI" onPress={reidentify} disabled={busy} />
        <Button title="Wrong plant?" color="#b9770e" onPress={() => navigation.navigate("WrongPlant", { plantId })} disabled={busy} />
        <Button title="Delete plant" color="#c0392b" onPress={remove} disabled={busy} />
      </View>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.text}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "600", color: "#111" },
  species: { fontSize: 18, color: "#222", marginTop: 4 },
  italic: { fontStyle: "italic", color: "#444" },
  warn: { color: "#b9770e", marginTop: 8, fontWeight: "500" },
  muted: { color: "#666", marginTop: 6 },
  section: { fontSize: 18, fontWeight: "600", marginTop: 24, color: "#111" },
  label: { fontWeight: "600", color: "#333" },
  text: { color: "#111" },
  buttons: { marginTop: 24, gap: 10 },
  error: { margin: 24, color: "#c0392b" },
});







