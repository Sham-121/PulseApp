// screens/BarcodeScannerNative.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { Button, Card, Paragraph } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";

/*
  Native wrapper for: https://models.samsarawellness.in/barcode/
  - Uploads an image (tries 'file' then 'image' field name)
  - Shows loading state and server response
  - Stores results locally in AsyncStorage under "SAVED_BARCODES"
  - If server response contains nutrition fields, displays them; otherwise shows raw JSON
*/
const BACKEND_URL = "https://models.samsarawellness.in/barcode/";

async function prepareImage(uri, maxWidth = 1600, compress = 0.8) {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result;
  } catch (err) {
    console.warn("Image manipulate failed, using original:", err);
    return { uri };
  }
}

function makeFileObject(uri) {
  const parts = uri.split("/");
  const name = parts[parts.length - 1] || `photo.jpg`;
  const extMatch = /\.(\w+)$/.exec(name);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  return {
    uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
    name,
    type: mime,
  };
}

export default function BarcodeScannerNative({ navigation }) {
  const [image, setImage] = useState(null); // { uri, width, height }
  const [loading, setLoading] = useState(false);
  const [serverResult, setServerResult] = useState(null);
  const [savedFoods, setSavedFoods] = useState([]);

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    try {
      const s = await AsyncStorage.getItem("SAVED_BARCODES");
      if (s) setSavedFoods(JSON.parse(s));
    } catch (err) {
      console.warn("Failed reading saved foods:", err);
    }
  };

  const saveResult = async (item) => {
    try {
      const newArr = [item, ...savedFoods].slice(0, 50);
      setSavedFoods(newArr);
      await AsyncStorage.setItem("SAVED_BARCODES", JSON.stringify(newArr));
    } catch (err) {
      console.warn("Failed saving result:", err);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow gallery access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,
    });
    if (!res.cancelled) {
      const prepared = await prepareImage(res.uri);
      setImage(prepared);
      setServerResult(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,
    });
    if (!res.cancelled) {
      const prepared = await prepareImage(res.uri);
      setImage(prepared);
      setServerResult(null);
    }
  };

  // Try multiple form field names used by web frontends
  const uploadImage = async () => {
    if (!image || !image.uri) {
      Alert.alert("No image selected", "Tap 'Choose Image' to pick or take a barcode photo.");
      return;
    }

    const fileObj = makeFileObject(image.uri);
    const fieldNames = ["file", "image"];
    setLoading(true);
    setServerResult(null);

    let lastErr = null;
    try {
      for (const field of fieldNames) {
        const fd = new FormData();
        fd.append(field, fileObj);

        const resp = await fetch(BACKEND_URL, {
          method: "POST",
          body: fd,
        });

        // If OK, parse JSON or fallback to text
        if (resp.ok) {
          let parsed;
          try {
            parsed = await resp.json();
          } catch {
            parsed = { rawText: await resp.text() };
          }
          const out = { method: "upload", field, status: resp.status, body: parsed, when: new Date().toISOString() };
          setServerResult(out);
          saveResult(out);
          setLoading(false);
          return;
        } else {
          const txt = await resp.text().catch(() => "");
          lastErr = `status ${resp.status}: ${txt}`;
        }
      }

      throw new Error(lastErr || "Upload failed");
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload failed", err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setImage(null);
    setServerResult(null);
  };

  // Small helper to render nutrition if present (best-effort)
  const renderNutrition = (body) => {
    if (!body) return null;
    // Look for common keys (name, calories, nutrients, nutrition)
    const name = body.name || body.title || body.product_name || null;
    const calories = body.calories || (body.nutrition && body.nutrition.calories) || null;
    const nutrients = body.nutrients || body.nutrition || null;

    return (
      <View style={{ marginTop: 8 }}>
        {name && <Text style={{ fontSize: 18, fontWeight: "700" }}>{name}</Text>}
        {calories && <Text style={{ marginTop: 4 }}>Calories: {String(calories)}</Text>}
        {nutrients && typeof nutrients === "object" && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontWeight: "600" }}>Nutrients</Text>
            {Object.entries(nutrients).map(([k, v]) => (
              <Text key={k}>
                {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </Text>
            ))}
          </View>
        )}
        {!name && !calories && !nutrients && (
          <Text style={{ marginTop: 6 }}>No structured nutrition fields detected — showing raw response below.</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.title}>Food Barcode Scanner</Text>
      <Text style={styles.subtitle}>Upload a photo of any food barcode to get nutritional information.</Text>

      <View style={styles.selectorRow}>
        <Button mode="contained" onPress={pickFromGallery} style={styles.btn}>
          Choose Image
        </Button>
        <Button mode="outlined" onPress={takePhoto} style={styles.btn}>
          Take Photo
        </Button>
      </View>

      <View style={{ marginTop: 12 }}>
        {image ? (
          <Card>
            <Card.Content style={{ alignItems: "center" }}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <Paragraph style={{ marginTop: 8 }}>
                {image.width ? `${image.width}×${image.height} • ` : ""}
                {image.uri.split("/").pop()}
              </Paragraph>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <Button mode="contained" onPress={uploadImage} style={{ marginRight: 8 }}>
                  Scan Barcode
                </Button>
                <Button mode="text" onPress={clearSelection}>
                  Clear
                </Button>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={{ padding: 12, alignItems: "center" }}>
            <Paragraph>Drag and drop is not available in-app. Use Choose Image or Take Photo.</Paragraph>
            <Paragraph style={{ marginTop: 8, color: "#666" }}>After choosing, tap Scan Barcode.</Paragraph>
          </Card>
        )}
      </View>

      {loading && (
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Scanning barcode and fetching nutrition data...</Text>
        </View>
      )}

      {serverResult && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700" }}>Result</Text>
          {renderNutrition(serverResult.body)}
          <Card style={{ marginTop: 10, padding: 10 }}>
            <Paragraph selectable>{JSON.stringify(serverResult.body, null, 2)}</Paragraph>
            <Paragraph style={{ marginTop: 8, color: "#666" }}>Field used: {serverResult.field}</Paragraph>
          </Card>
        </View>
      )}

      <View style={{ marginTop: 18 }}>
        <Text style={{ fontWeight: "700" }}>Saved Foods</Text>
        {savedFoods.length === 0 ? (
          <Paragraph style={{ marginTop: 8, color: "#666" }}>No saved scans yet.</Paragraph>
        ) : (
          savedFoods.map((s, idx) => (
            <Card key={idx} style={{ marginTop: 8, padding: 8 }}>
              <Paragraph numberOfLines={2}>{s.body && s.body.name ? s.body.name : JSON.stringify(s.body).slice(0, 120)}</Paragraph>
              <Paragraph style={{ color: "#666", marginTop: 6 }}>{new Date(s.when).toLocaleString()}</Paragraph>
            </Card>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: "#444", marginBottom: 12 },
  selectorRow: { flexDirection: "row", justifyContent: "space-between" },
  btn: { flex: 1, marginHorizontal: 6 },
  previewImage: { width: 260, height: 140, borderRadius: 6, marginTop: 8 },
});
