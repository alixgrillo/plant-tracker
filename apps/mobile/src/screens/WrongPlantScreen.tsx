import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { IdentifyResult } from "@plant-tracker/shared";
import type { RootStackParamList } from "../navigation";
import { identifyPlant, sendFeedback } from "../lib/api";
import { applyIdentification, getPlant, type PlantDetail } from "../lib/plants";

type Props = NativeStackScreenProps<RootStackParamList, "WrongPlant">;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function WrongPlantScreen({ route, navigation }: Props) {
  const { plantId } = route.params;
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);

  useEffect(() => {
    getPlant(plantId).then(setPlant).catch((e) => Alert.alert("Could not load plant", msg(e)));
  }, [plantId]);

  if (!plant) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const report = (extra: { modelUsed?: string; userSuggestedSpecies?: string } = {}) =>
    sendFeedback({
      plantId,
      aiSpeciesCommon: plant.species_common ?? undefined,
      aiSpeciesScientific: plant.species_scientific ?? undefined,
      aiConfidence: plant.care?.ai_confidence ?? undefined,
      modelUsed: extra.modelUsed ?? plant.care?.ai_model ?? undefined,
      userSuggestedSpecies: extra.userSuggestedSpecies,
      note: note.trim() || undefined,
      imagePath: plant.photo_path ?? undefined,
    });

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

  const smarterCheck = () =>
    run(async () => {
      const r = await identifyPlant({
        ...(plant.photo_path ? { imagePath: plant.photo_path } : { name: plant.nickname }),
        quality: "high",
        notThis: plant.species_common ?? undefined,
      });
      setResult(r);
      report({ modelUsed: r.model }).catch(() => {});
    });

  const useMySuggestion = () =>
    run(async () => {
      const name = suggestion.trim();
      if (!name) return Alert.alert("Type the plant you think it is first");
      const r = await identifyPlant({ name });
      setResult(r);
      report({ userSuggestedSpecies: name, modelUsed: r.model }).catch(() => {});
    });

  const feedbackOnly = () =>
    run(async () => {
      await report({ userSuggestedSpecies: suggestion.trim() || undefined });
      Alert.alert("Thanks!", "Your feedback was sent.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    });

  const apply = () =>
    run(async () => {
      if (!result) return;
      await applyIdentification(plantId, result);
      navigation.goBack();
    });

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>Current guess</Text>
      <Text style={s.text}>
        {plant.species_common ?? "Unknown"}
        {plant.care?.ai_confidence ? ` (${plant.care.ai_confidence} confidence)` : ""}
      </Text>

      <Text style={s.label}>Try again</Text>
      <Button title="Try a smarter check" onPress={smarterCheck} disabled={busy} />

      <Text style={s.label}>Think you know what it is?</Text>
      <TextInput style={s.input} placeholder="e.g. Philodendron hederaceum" placeholderTextColor="#888" value={suggestion} onChangeText={setSuggestion} />
      <Button title="Use my suggestion" onPress={useMySuggestion} disabled={busy} />

      <Text style={s.label}>Note for the developer (optional)</Text>
      <TextInput style={[s.input, { minHeight: 64 }]} multiline value={note} onChangeText={setNote} />
      <Button title="Send feedback only" color="#888" onPress={feedbackOnly} disabled={busy} />

      {busy && <ActivityIndicator style={{ margin: 12 }} />}

      {result && (
        <>
          <Text style={s.h}>New result</Text>
          <Text style={s.text}>
            {result.commonName} ({result.confidence} confidence)
          </Text>
          <Text style={s.italic}>{result.scientificName}</Text>
          <Text style={s.text}>{result.care.description}</Text>
          <Button title="Apply this result" onPress={apply} disabled={busy} />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 8 },
  h: { fontSize: 18, fontWeight: "600", color: "#111", marginTop: 12 },
  label: { fontWeight: "600", color: "#333", marginTop: 12 },
  text: { color: "#111" },
  italic: { fontStyle: "italic", color: "#444" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, color: "#111" },
});
