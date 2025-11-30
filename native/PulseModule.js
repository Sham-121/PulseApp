// src/native/PulseModule.js
import { NativeModules } from "react-native";

const { PulseModule } = NativeModules;

if (!PulseModule) {
  console.warn(
    "[PulseModule] Native module not found. " +
      "Are you running in Expo Go or missing native setup?"
  );
}

export async function getTestBpm() {
  if (!PulseModule || typeof PulseModule.getTestBpm !== "function") {
    throw new Error("PulseModule.getTestBpm is not available");
  }
  const value = await PulseModule.getTestBpm();
  return value;
}
