import { useState } from "react";
import { ActivityIndicator, Alert, Button, Image, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import type { IdentifyResult } from "@plant-tracker/shared";
import { identifyPlant } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

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
          health_signs: c.healthSigns,
          source: "ai",
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
      <TextInput style={s.input} placeholder="Plant name (e.g. Kitchen pothos)" value={nickname} onChangeText={setNickname} />
      <Button title="Take photo" onPress={() => pick(true)} />
      <Button title="Choose from library" onPress={() => pick(false)} />
      {busy && <ActivityIndicator style={{ margin: 16 }} />}
      {photoUri && <Image source={{ uri: photoUri }} style={s.photo} />}
      {result && (
        <>
          <Text style={s.h}>{result.commonName} ({result.confidence} confidence)</Text>
          <Text style={s.i}>{result.scientificName}</Text>
          <Text>{result.care.description}</Text>
          <Text style={s.label}>Light</Text><Text>{result.care.light}</Text>
          <Text style={s.label}>Water every {result.care.waterMinDays}-{result.care.waterMaxDays} days</Text>
          <Text>{result.care.waterNotes}</Text>
          {result.care.waterHow ? <><Text style={s.label}>How to water</Text><Text>{result.care.waterHow}</Text></> : null}
          <Text style={s.label}>Healthy signs</Text><Text>{result.care.healthSigns}</Text>
        </>
      )}
      <Button title="Save plant" onPress={save} disabled={busy} />
      <Button title="Cancel" color="#888" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 },
  photo: { width: "100%", height: 240, borderRadius: 8 },
  h: { fontSize: 20, fontWeight: "600" },
  i: { fontStyle: "italic" },
  label: { fontWeight: "600", marginTop: 8 },
});




