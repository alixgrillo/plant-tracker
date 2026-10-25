import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { AuthScreen } from "./src/screens/AuthScreen";
import { PlantListScreen } from "./src/screens/PlantListScreen";
import { AddPlantScreen } from "./src/screens/AddPlantScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [adding, setAdding] = useState(false);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  let screen;
  if (!session) screen = <AuthScreen />;
  else if (adding)
    screen = <AddPlantScreen onDone={() => { setAdding(false); setListKey((k) => k + 1); }} />;
  else screen = <PlantListScreen key={listKey} onAdd={() => setAdding(true)} />;

  return (
    <>
      {screen}
      <StatusBar style="auto" />
    </>
  );
}
