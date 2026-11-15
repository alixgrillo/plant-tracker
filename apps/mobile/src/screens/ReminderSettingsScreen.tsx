import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { getReminderTime, setReminderTime, syncReminders } from "../lib/reminders";
import { AppButton, Card, colors } from "../theme";

export function ReminderSettingsScreen() {
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReminderTime().then(setTime).catch(() => {
      Alert.alert("Could not load reminder time");
      setTime("09:00");
    });
  }, []);

  const save = async () => {
    if (time === null) return;
    setSaving(true);
    try {
      await setReminderTime(time);
      const result = await syncReminders();
      if (result === "denied") {
        Alert.alert("Time saved", "Allow notifications in your phone settings to receive reminders.");
      } else if (result === "unsupported") {
        Alert.alert("Time saved", "Reminders are available in the mobile app.");
      } else {
        Alert.alert("Time saved", "Reminders have been updated on this device.");
      }
      setTime(time.trim());
    } catch (error) {
      Alert.alert("Could not update reminders", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  if (time === null) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 12 }}>
        <Text style={s.title}>Reminder time</Text>
        <Text style={s.text}>Set a time in 24-hour format, using your device's local time. For example, 18:30 is 6:30 PM.</Text>
        <TextInput
          accessibilityLabel="Reminder time in 24-hour HH:MM format"
          style={s.input}
          value={time}
          onChangeText={setTime}
          placeholder="09:00"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={5}
        />
        <AppButton title={saving ? "Saving..." : "Save reminder time"} onPress={save} disabled={saving} />
      </Card>
      <Text style={s.text}>
        Watering reminders repeat for the next three days if not marked watered, with stronger overdue messages.
        Fertilizing reminders are sent once when due. Reminders are planned up to 30 days ahead;
        opening the app refreshes them.
      </Text>
      <Text style={s.text}>
        Reminders are based on your schedule, not a plant survival deadline. Check the soil and plant before watering.
        Settings and notifications are specific to this device.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  text: { color: colors.text, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: colors.card },
});
