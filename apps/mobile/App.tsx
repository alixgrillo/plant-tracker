import { useEffect, useState } from "react";
import { ActivityIndicator, Appearance, Button } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import type { RootStackParamList } from "./src/navigation";
import { AuthScreen } from "./src/screens/AuthScreen";
import { PlantListScreen } from "./src/screens/PlantListScreen";
import { AddPlantScreen } from "./src/screens/AddPlantScreen";
import { PlantDetailScreen } from "./src/screens/PlantDetailScreen";
import { EditPlantScreen } from "./src/screens/EditPlantScreen";

Appearance.setColorScheme("light");

const Stack = createNativeStackNavigator<RootStackParamList>();

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
            <Stack.Screen
              name="PlantList"
              component={PlantListScreen}
              options={({ navigation }) => ({
                title: "My Plants",
                headerRight: () => <Button title="Add" onPress={() => navigation.navigate("AddPlant")} />,
                headerLeft: () => <Button title="Sign out" color="#888" onPress={() => supabase.auth.signOut()} />,
              })}
            />
            <Stack.Screen name="AddPlant" component={AddPlantScreen} options={{ title: "Add plant" }} />
            <Stack.Screen name="PlantDetail" component={PlantDetailScreen} options={{ title: "Plant" }} />
            <Stack.Screen name="EditPlant" component={EditPlantScreen} options={{ title: "Edit plant" }} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}
