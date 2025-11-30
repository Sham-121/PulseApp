// screens/PulseScanScreen.js
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Button } from "react-native-paper";
import { getTestBpm } from "../native/PulseModule";

export default function PulseScanScreen() {
  const [bpm, setBpm] = useState(null);

  const handleMeasure = async () => {
    try {
      const value = await getTestBpm();
      setBpm(value);
      Alert.alert("Native OK", `Test BPM from native: ${value}`);
    } catch (e) {
      console.error("PulseModule error:", e);
      Alert.alert("Error", e.message || String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pulse Scan (Test)</Text>
      <Button mode="contained" onPress={handleMeasure} style={styles.button}>
        Call Native getTestBpm
      </Button>
      {bpm !== null && <Text style={styles.bpmText}>BPM: {bpm}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  button: { width: "70%", borderRadius: 10, marginBottom: 16 },
  bpmText: { fontSize: 24, fontWeight: "700" },
});
