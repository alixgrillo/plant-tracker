import { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import type { IdentifyResult } from "@plant-tracker/shared";
import { identifyPlant } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { AppButton, Card, Chip, colors } from "../theme";

export function AddPlantScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "AddPlant">) {
  const [nickname, setNickname] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (camera: boolean) => {
    setBusy(true);
    try {
      const perm = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow access in your phone settings.");
        return;
      }
      const launch = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const picked = await launch({ mediaTypes: ["images"], quality: 1 });
      if (picked.canceled) return;
      const small = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("plant-photos")
        .upload(path, decode(small.base64!), { contentType: "image/jpeg" });
      if (error) throw error;
      setPhotoUri(small.uri);
      setPhotoPath(path);
      setResult(await identifyPlant({ imagePath: path }));
    } catch (e) {
      Alert.alert("Could not identify plant", String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!nickname.trim()) return Alert.alert("Give your plant a name");
    setBusy(true);
    try {
      const { data: plant, error } = await supabase
        .from("plants")
        .insert({
          nickname: nickname.trim(),
          species_common: result?.commonName ?? null,
          species_scientific: result?.scientificName ?? null,
          photo_path: photoPath,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (result) {
        const c = result.care;
        const { error: e2 } = await supabase.from("care_profiles").insert({
          plant_id: plant.id,
          description: c.description,
          light: c.light,
          water_min_days: c.waterMinDays,
          water_max_days: c.waterMaxDays,
          water_notes: c.waterNotes,
          water_how: c.waterHow,
          fertilizer_every_days: c.fertilizerEveryDays,
          fertilizer_notes: c.fertilizerNotes,
          fertilizer_type: c.fertilizerType,
          self_watering_pot_recommendation: c.selfWateringPotRecommendation,
          self_watering_pot_notes: c.selfWateringPotNotes,
          health_signs: c.healthSigns,
          source: "ai",
          ai_confidence: result.confidence,
          ai_model: result.model ?? null,
        });
        if (e2) throw e2;
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert("Save failed", String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.container}>
      <TextInput style={s.input} placeholder="Plant name (e.g. Kitchen pothos)" placeholderTextColor={colors.muted} value={nickname} onChangeText={setNickname} />
      <View style={s.row}>
        <AppButton title="📷 Take photo" onPress={() => pick(true)} style={s.flex} />
        <AppButton title="🖼️ Library" variant="secondary" onPress={() => pick(false)} style={s.flex} />
      </View>
      {busy && <ActivityIndicator style={{ margin: 16 }} />}
      {photoUri && <Image source={{ uri: photoUri }} style={s.photo} />}
      {result && (
        <Card style={{ gap: 4 }}>
          <Text style={s.h}>{result.commonName}</Text>
          <Chip label={`${result.confidence} confidence`} tone={result.confidence === "high" ? "green" : "amber"} />
          <Text style={s.i}>{result.scientificName}</Text>
          <Text style={s.body}>{result.care.description}</Text>
          <Text style={s.label}>☀️ Light</Text><Text style={s.body}>{result.care.light}</Text>
          <Text style={s.label}>💧 Water every {result.care.waterMinDays}-{result.care.waterMaxDays} days</Text>
          <Text style={s.body}>{result.care.waterNotes}</Text>
          {result.care.waterHow ? <><Text style={s.label}>🚿 How to water</Text><Text style={s.body}>{result.care.waterHow}</Text></> : null}
          <Text style={s.label}>🌱 Fertilizer schedule</Text>
          <Text style={s.body}>
            {result.care.fertilizerType ? `${result.care.fertilizerType}\n` : ""}
            {result.care.fertilizerEveryDays
              ? `Every ${result.care.fertilizerEveryDays} days${result.care.fertilizerNotes ? ` — ${result.care.fertilizerNotes}` : ""}`
              : result.care.fertilizerNotes || "No regular fertilizer schedule recommended"}
          </Text>
          <Text style={s.label}>🏺 Self-watering pot</Text>
          <Text style={s.body}>
            {result.care.selfWateringPotRecommendation === "not_recommended"
              ? "Not recommended"
              : result.care.selfWateringPotRecommendation === "recommended"
                ? "Recommended"
                : "Depends on setup"}
            {result.care.selfWateringPotNotes ? ` — ${result.care.selfWateringPotNotes}` : ""}
          </Text>
          <Text style={s.label}>💚 Healthy signs</Text><Text style={s.body}>{result.care.healthSigns}</Text>
        </Card>
      )}
      <AppButton title="Save plant" onPress={save} disabled={busy} />
      <AppButton title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.card, color: colors.text },
  photo: { width: "100%", height: 240, borderRadius: 16 },
  h: { fontSize: 22, fontWeight: "800", color: colors.text },
  i: { fontStyle: "italic", color: colors.muted },
  body: { color: colors.text, lineHeight: 21 },
  label: { fontWeight: "700", color: colors.primaryDark, marginTop: 10 },
});



