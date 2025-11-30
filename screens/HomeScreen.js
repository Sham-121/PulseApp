// screens/HomeScreen.js
import React from "react";
import { View, StyleSheet } from "react-native";
import { Button } from "react-native-paper";
import { Alert } from "react-native";
import { getTestBpm } from "../native/PulseModule"; 

const HomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Button
        style={styles.button}
        mode="contained"
        onPress={() => navigation.navigate("Instructions")}
      >
        Check Pulse
      </Button>

      <Button
        style={styles.button}
        mode="contained"
        onPress={() => navigation.navigate("AyurvedaBot")}
      >
        Ayurveda Bot
      </Button>


      <Button 
      style={styles.button} 
      mode="contained" 
      onPress={() => navigation.navigate("BarcodeScannerNative")}>
        Barcode Scanner
      </Button>


      <Button
      style={styles.button}
      mode="contained"
      onPress={() => navigation.navigate("FoodScanner")}
    >
      Food Scanner
    </Button>


      <Button
        style={styles.button}
        mode="contained"
        onPress={() => alert("Coming soon")}
      >
        Mental Health
      </Button>

      <Button
        style={styles.button}
        mode="contained"
        onPress={async () => {
          try {
            const value = await getTestBpm();
            Alert.alert("Native Module Works ✅", `Test BPM = ${value}`);
          } catch (e) {
            console.error("Native test failed:", e);
            Alert.alert("Native Module Error ❌", e.message || String(e));
          }
        }}
      >
        Test Native Module
</Button>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  button: {
    marginVertical: 10,
    width: "80%",
    borderRadius: 10,
    paddingVertical: 10,
  },
});

export default HomeScreen;
