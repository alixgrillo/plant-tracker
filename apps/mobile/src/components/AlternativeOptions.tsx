import { useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import type { IdentifyResult, PlantAlternative } from "@plant-tracker/shared";
import { AppButton, Card, colors } from "../theme";

export function AlternativeOptions({
  result,
  busy,
  onChoose,
}: {
  result: IdentifyResult;
  busy: boolean;
  onChoose: (choice: PlantAlternative) => void;
}) {
  if (result.confidence === "high") return null;
  return (
    <View style={s.list}>
      <Text style={s.heading}>Other possible plants</Text>
      <Text style={s.text}>Compare these lookalikes. Reference photos may vary. Selecting one gets new care guidance; it does not verify the identification.</Text>
      {result.alternatives?.length
        ? result.alternatives.map((choice) => (
            <AlternativeCard key={choice.scientificName} choice={choice} busy={busy} onChoose={onChoose} />
          ))
        : <Text style={s.text}>No other options available for this identification.</Text>}
    </View>
  );
}

function AlternativeCard({ choice, busy, onChoose }: {
  choice: PlantAlternative;
  busy: boolean;
  onChoose: (choice: PlantAlternative) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Card style={s.card}>
      {choice.photo && !failed
        ? <Image source={{ uri: choice.photo.url }} style={s.image} onError={() => setFailed(true)} />
        : <View style={s.placeholder}><Text style={s.text}>Reference photo unavailable</Text></View>}
      <Text style={s.name}>{choice.commonName}</Text>
      <Text style={s.italic}>{choice.scientificName}</Text>
      {choice.photo && !failed ? (
        <>
          <Text style={s.credit} accessibilityRole="link" onPress={() => void Linking.openURL(choice.photo!.sourceUrl)}>
            {choice.photo.attribution} (iNaturalist)
          </Text>
          <Text style={s.credit} accessibilityRole="link" onPress={() => void Linking.openURL(choice.photo!.licenseUrl)}>
            Photo license
          </Text>
        </>
      ) : null}
      <AppButton title="Choose this plant" variant="secondary" disabled={busy} onPress={() => onChoose(choice)} />
    </Card>
  );
}

const s = StyleSheet.create({
  list: { gap: 10, marginTop: 12 },
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  text: { color: colors.text, lineHeight: 20 },
  card: { gap: 6 },
  image: { width: "100%", height: 180, borderRadius: 10 },
  placeholder: { height: 100, backgroundColor: colors.leaf, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  name: { color: colors.text, fontWeight: "700", fontSize: 16 },
  italic: { color: colors.muted, fontStyle: "italic" },
  credit: { color: colors.primaryDark, fontSize: 12, textDecorationLine: "underline" },
});
