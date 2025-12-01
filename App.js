// App.js
import React from "react";
import { StatusBar, View } from "react-native";
import { Provider as PaperProvider, DefaultTheme as PaperDefaultTheme } from "react-native-paper";
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./screens/HomeScreen";
import InstructionsScreen from "./screens/InstructionsScreen";
import AyurvedaBotScreen from "./screens/AyurvedaBotScreen";
import BarcodeScannerNative from "./screens/BarcodeScannerNative";
import FoodScanner from "./screens/FoodScannerScreen"; // ensure filename matches
import PulseScanScreen from "./screens/PulseScanScreen";



// Customize your light theme here
// Use the colors you prefer (these match the purple accent you used while testing)
const APP_PRIMARY = "#684bf7ff"; // purple primary for buttons
const APP_ACCENT = "#E9D5FF";
const APP_BACKGROUND = "#FFFFFF";
const APP_SURFACE = "#FFFFFF";
const APP_TEXT = "#111111";
const APP_PLACEHOLDER = "#666666";

const paperTheme = {
  ...PaperDefaultTheme,
  dark: false,
  roundness: 8,
  colors: {
    ...PaperDefaultTheme.colors,
    primary: APP_PRIMARY,
    accent: APP_ACCENT,
    background: APP_BACKGROUND,
    surface: APP_SURFACE,
    text: APP_TEXT,
    placeholder: APP_PLACEHOLDER,
    backdrop: "rgba(0,0,0,0.32)",
    notification: "#FF5252",
  },
};

const navTheme = {
  ...NavigationDefaultTheme,
  dark: false,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: APP_PRIMARY,
    background: APP_BACKGROUND,
    card: APP_SURFACE,
    text: APP_TEXT,
    border: "#E8E8E8",
  },
};

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        
        <StatusBar barStyle="dark-content" backgroundColor={APP_BACKGROUND} />
        <Stack.Navigator initialRouteName="Home" screenOptions={{
          headerStyle: { backgroundColor: APP_SURFACE },
          headerTintColor: APP_TEXT,
          contentStyle: { backgroundColor: APP_BACKGROUND }
        }}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "PulseApp — Home" }} />
          <Stack.Screen name="Instructions" component={InstructionsScreen} />
          <Stack.Screen name="AyurvedaBot" component={AyurvedaBotScreen} />
          <Stack.Screen name="BarcodeScannerNative" component={BarcodeScannerNative} options={{ title: "Barcode Scanner" }} />
          <Stack.Screen name="FoodScanner" component={FoodScanner} options={{ title: "Food Scanner" }} />
          <Stack.Screen name="PulseScan" component={PulseScanScreen} options={{ title: "Pulse Scan" }}/>
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
