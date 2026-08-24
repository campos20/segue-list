import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { store } from "@/store";
import { LibraryGate } from "@/ui/LibraryGate";
import { colors } from "@/ui/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <LibraryGate>
          <StatusBar style="light" />
          {/* No transition animation: removes the window where two screens'
              native view trees are both present during an animated
              transition, and keeps navigation fully predictable. */}
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "none",
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </LibraryGate>
      </Provider>
    </SafeAreaProvider>
  );
}
