import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { store } from "@/store";
import { LibraryGate } from "@/ui/LibraryGate";
import { useThemeColors, useThemeMode } from "@/ui/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <LibraryGate>
          <ThemedApp />
        </LibraryGate>
      </Provider>
    </SafeAreaProvider>
  );
}

// Split out from RootLayout because useThemeColors()/useThemeMode() need the
// Redux Provider above them in the tree - a hook call in the component that
// renders the Provider itself would run before that context exists.
function ThemedApp() {
  const colors = useThemeColors();
  const mode = useThemeMode();

  return (
    <>
      <StatusBar style={mode} />
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
    </>
  );
}
