import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { syncReminders } from "../lib/reminders";
import type { RootStackParamList } from "../navigation";
import { identifyPlant } from "../lib/api";
import { nextFertilizerDue, nextWaterDue, wateringIntervalDays } from "@plant-tracker/shared";
import {
  applyIdentification,
  deletePlant,
  getPlant,
  markFertilized,
  markWatered,
  signedPhotoUrls,
  type PlantDetail,
} from "../lib/plants";
import { AppButton, Card, Chip, colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "PlantDetail">;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const potLabel = {
  recommended: "Recommended",
  not_recommended: "Not recommended",
  depends: "Depends on setup",
} as const;

export function PlantDetailScreen({ route, navigation }: Props) {
  const { plantId } = route.params;
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getPlant(plantId);
      setPlant(p);
      setError(null);
      setPhotoUrl(p.photo_path ? ((await signedPhotoUrls([p.photo_path]))[p.photo_path] ?? null) : null);
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
      void syncReminders().catch(() => undefined);
    });

  const fertilized = () =>
    run(async () => {
      await markFertilized(plantId);
      await load();
      void syncReminders().catch(() => undefined);
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
  const fertilizerDue = nextFertilizerDue(
    plant.lastFertilized ? new Date(plant.lastFertilized) : null,
    new Date(plant.created_at),
    c?.fertilizer_every_days ?? null,
  );
  const unsure = c?.source === "ai" && c.ai_confidence && c.ai_confidence !== "high";
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const waterOverdue = !!due && due.getTime() < startOfToday;
  const fertOverdue = !!fertilizerDue && fertilizerDue.getTime() < startOfToday;

  return (
    <ScrollView contentContainerStyle={s.container}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={s.hero} />
      ) : (
        <View style={[s.hero, s.heroPlaceholder]}>
          <Text style={{ fontSize: 64 }}>🌿</Text>
        </View>
      )}

      <View style={s.body}>
        <Text style={s.title}>{plant.nickname}</Text>
        {plant.species_common ? <Text style={s.species}>{plant.species_common}</Text> : null}
        {plant.species_scientific ? <Text style={s.italic}>{plant.species_scientific}</Text> : null}
        <View style={s.chips}>
          {plant.location ? <Chip label={`📍 ${plant.location}`} /> : null}
          <Chip label={`Added ${new Date(plant.created_at).toLocaleDateString()}`} />
        </View>
        {unsure ? (
          <Card style={s.warnCard}>
            <Text style={s.warn}>
              {c!.ai_confidence} confidence - double-check this species. Tap "Wrong plant?" below if it looks off.
            </Text>
          </Card>
        ) : null}
        {plant.notes ? <Section icon="📝" title="Notes" body={plant.notes} /> : null}

        <Card style={s.statusCard}>
          <View style={s.statusCol}>
            <Text style={s.statusLabel}>💧 Next watering</Text>
            <Text style={[s.statusValue, waterOverdue && { color: colors.danger }]}>
              {due ? due.toLocaleDateString() : "—"}
            </Text>
            <Text style={s.statusSub}>
              {due
                ? `every ${interval} days${plant.water_interval_override ? " (your setting)" : ""}`
                : "Add care info or an interval"}
            </Text>
            <Text style={s.statusSub}>
              Last: {plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : "not recorded"}
            </Text>
          </View>
          {c?.fertilizer_every_days ? (
            <View style={s.statusCol}>
              <Text style={s.statusLabel}>🌱 Next fertilizing</Text>
              <Text style={[s.statusValue, fertOverdue && { color: colors.danger }]}>
                {fertilizerDue ? fertilizerDue.toLocaleDateString() : "—"}
              </Text>
              <Text style={s.statusSub}>every {c.fertilizer_every_days} days</Text>
              <Text style={s.statusSub}>
                Last: {plant.lastFertilized ? new Date(plant.lastFertilized).toLocaleDateString() : "not recorded"}
              </Text>
            </View>
          ) : null}
        </Card>

        <View style={s.row}>
          <AppButton title="💧 Watered" onPress={watered} disabled={busy} style={s.flex} />
          {c?.fertilizer_every_days ? (
            <AppButton title="🌱 Fertilized" variant="secondary" onPress={fertilized} disabled={busy} style={s.flex} />
          ) : null}
        </View>
        {busy && <ActivityIndicator style={{ margin: 8 }} />}

        <Text style={s.heading}>
          Care info{c ? ` · ${c.source === "ai" ? "AI suggested" : "edited by you"}` : ""}
        </Text>
        {c ? (
          <>
            <Section icon="📖" title="About" body={c.description} />
            <Section icon="☀️" title="Light" body={c.light} />
            <Section
              icon="💧"
              title="Watering"
              body={`Every ${c.water_min_days ?? "?"}-${c.water_max_days ?? "?"} days${c.water_notes ? `\n${c.water_notes}` : ""}`}
            />
            <Section icon="🚿" title="How to water" body={c.water_how} />
            <Section
              icon="🌱"
              title="Fertilizer"
              body={[
                c.fertilizer_type,
                c.fertilizer_every_days ? `Every ${c.fertilizer_every_days} days` : "No regular schedule",
                c.fertilizer_notes,
              ]
                .filter(Boolean)
                .join("\n")}
            />
            <Section
              icon="🏺"
              title="Self-watering pot"
              body={`${potLabel[c.self_watering_pot_recommendation] ?? potLabel.depends}${c.self_watering_pot_notes ? `\n${c.self_watering_pot_notes}` : ""}`}
            />
            <Section icon="💚" title="Healthy signs" body={c.health_signs} />
          </>
        ) : (
          <Text style={s.muted}>No care info yet. Try "Re-identify with AI".</Text>
        )}

        <View style={s.buttons}>
          <AppButton title="Edit" variant="secondary" onPress={() => navigation.navigate("EditPlant", { plantId })} disabled={busy} />
          <AppButton title="Re-identify with AI" variant="secondary" onPress={reidentify} disabled={busy} />
          <AppButton title="Wrong plant?" variant="warn" onPress={() => navigation.navigate("WrongPlant", { plantId })} disabled={busy} />
          <AppButton title="Delete plant" variant="danger" onPress={remove} disabled={busy} />
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ icon, title, body }: { icon: string; title: string; body: string | null }) {
  if (!body) return null;
  return (
    <Card style={s.section}>
      <Text style={s.sectionTitle}>{icon} {title}</Text>
      <Text style={s.text}>{body}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  container: { paddingBottom: 40 },
  hero: { width: "100%", height: 280, backgroundColor: colors.leaf },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 10, marginTop: -20, backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  species: { fontSize: 18, color: colors.primary, fontWeight: "600" },
  italic: { fontStyle: "italic", color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warnCard: { backgroundColor: colors.warnBg },
  warn: { color: "#9a6212", fontWeight: "500" },
  statusCard: { flexDirection: "row", gap: 16 },
  statusCol: { flex: 1 },
  statusLabel: { fontWeight: "700", color: colors.text },
  statusValue: { fontSize: 20, fontWeight: "800", color: colors.primary, marginTop: 4 },
  statusSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  heading: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 12 },
  section: { gap: 4 },
  sectionTitle: { fontWeight: "700", color: colors.primaryDark, fontSize: 15 },
  text: { color: colors.text, lineHeight: 21 },
  muted: { color: colors.muted },
  buttons: { marginTop: 16, gap: 10 },
  error: { margin: 24, color: colors.danger },
});
