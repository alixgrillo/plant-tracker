import { useEffect, useState } from "react";
import { ActivityIndicator, Appearance, Button } from "react-native";
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
import { AddPlantScreen } from "./src/screens/AddPlantScreen";
import { PlantDetailScreen } from "./src/screens/PlantDetailScreen";
import { EditPlantScreen } from "./src/screens/EditPlantScreen";
import { WrongPlantScreen } from "./src/screens/WrongPlantScreen";

Appearance.setColorScheme("light");

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function AddButton() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <Button title="Add" onPress={() => nav.navigate("AddPlant")} />;
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ tabBarActiveTintColor: "#2e8b57" }}>
      <Tabs.Screen
        name="PlantList"
        component={PlantListScreen}
        options={{
          title: "My Plants",
          tabBarLabel: "Plants",
          headerRight: () => <AddButton />,
          headerLeft: () => <Button title="Sign out" color="#888" onPress={() => supabase.auth.signOut()} />,
        }}
      />
      <Tabs.Screen name="Calendar" component={CalendarScreen} options={{ title: "Watering calendar" }} />
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

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <NavigationContainer theme={DefaultTheme}>
      <Stack.Navigator>
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
