import { useEffect, useState } from "react";
import { syncReminders } from "./src/lib/reminders";
import { ActivityIndicator, AppState, Appearance, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import type { RootStackParamList, TabParamList } from "./src/navigation";
import { AuthScreen } from "./src/screens/AuthScreen";
import { PlantListScreen } from "./src/screens/PlantListScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import { AddPlantScreen } from "./src/screens/AddPlantScreen";
import { PlantDetailScreen } from "./src/screens/PlantDetailScreen";
import { EditPlantScreen } from "./src/screens/EditPlantScreen";
import { WrongPlantScreen } from "./src/screens/WrongPlantScreen";
import { AppButton, colors, headerOptions } from "./src/theme";

Appearance.setColorScheme("light");

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary, card: colors.bg, text: colors.text, border: colors.border },
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const tabIcon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

function AddButton() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <AppButton small title="+ Add" onPress={() => nav.navigate("AddPlant")} />;
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: "600" },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700", color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="PlantList"
        component={PlantListScreen}
        options={{
          title: "My Plants",
          tabBarLabel: "Plants",
          tabBarIcon: tabIcon("🪴"),
          headerRight: () => <View style={{ marginRight: 12 }}><AddButton /></View>,
          headerLeft: () => (
            <View style={{ marginLeft: 12 }}>
              <AppButton small variant="secondary" title="Sign out" onPress={() => supabase.auth.signOut()} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="Calendar" component={CalendarScreen} options={{ title: "Care calendar", tabBarLabel: "Calendar", tabBarIcon: tabIcon("📅") }} />
      <Tabs.Screen name="Summary" component={SummaryScreen} options={{ title: "Summary", tabBarIcon: tabIcon("📊") }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const run = () => void syncReminders().catch(() => undefined);
    run();
    const sub = AppState.addEventListener("change", (s) => s === "active" && run());
    return () => sub.remove();
  }, [session]);

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={headerOptions}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddPlant" component={AddPlantScreen} options={{ title: "Add plant" }} />
            <Stack.Screen name="PlantDetail" component={PlantDetailScreen} options={{ title: "Plant" }} />
            <Stack.Screen name="EditPlant" component={EditPlantScreen} options={{ title: "Edit plant" }} />
            <Stack.Screen name="WrongPlant" component={WrongPlantScreen} options={{ title: "Wrong plant?" }} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}
