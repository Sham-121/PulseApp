// screens/FoodScannerScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Button } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const BACKEND_URL = "https://models.samsarawellness.in/food";

// Utility: compress/resize to keep under server limit (maxWidth in px)
async function prepareImage(uri, maxWidth = 1600, compress = 0.8) {
  // If you need more aggressive compression, lower compress (0.6) or maxWidth (1200)
  try {
    // Resize only if width is larger than maxWidth
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult; // { uri, width, height }
  } catch (err) {
    console.warn("Image manipulation failed, using original:", err);
    return { uri }; // fallback
  }
}

export default function FoodScannerScreen({ navigation }) {
  const [image, setImage] = useState(null); // { uri, width, height }
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please grant gallery access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,
    });
    if (!res.cancelled) {
      setResult(null);
      const prepared = await prepareImage(res.uri);
      setImage(prepared);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please grant camera access.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,
    });
    if (!res.cancelled) {
      setResult(null);
      const prepared = await prepareImage(res.uri);
      setImage(prepared);
    }
  }

  // Build FormData entry object for given uri
  function fileObjectFromUri(uri) {
    const uriParts = uri.split("/");
    const name = uriParts[uriParts.length - 1] || `photo.jpg`;
    // on iOS, uri may start with 'file://'
    let fileName = name;
    // guess mime
    const extMatch = /\.(\w+)$/.exec(fileName);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const type = ext === "png" ? "image/png" : "image/jpeg";
    return {
      uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
      name: fileName,
      type,
    };
  }

  // upload — tries 'file' first, falls back to 'image'
  async function uploadToBackend() {
    if (!image || !image.uri) {
      Alert.alert("No image", "Pick or take a photo first.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const fileObj = fileObjectFromUri(image.uri);

      // Try multiple field names automatically
      const fieldNamesToTry = ["file", "image"];
      let lastError = null;
      for (const fieldName of fieldNamesToTry) {
        const form = new FormData();
        form.append(fieldName, fileObj);
        // If backend need additional fields, append them here:
        // form.append("user_id", "12345");

        const resp = await fetch(BACKEND_URL, {
          method: "POST",
          body: form,
          // NOTE: do NOT set Content-Type; letting fetch set boundary is required
        });

        if (resp.ok) {
          // try parse as json; if parse fails, read text
          let parsed;
          try {
            parsed = await resp.json();
          } catch (err) {
            const text = await resp.text();
            parsed = { rawText: text };
          }
          setResult({ fieldNameUsed: fieldName, body: parsed, status: resp.status });
          setUploading(false);
          return;
        } else {
          // keep last error and try next fieldName
          const text = await resp.text().catch(() => "");
          lastError = new Error(`Status ${resp.status}: ${text}`);
        }
      }

      // If none succeeded:
      throw lastError || new Error("Unknown upload error");
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload failed", err.message || "Unknown error");
      setUploading(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Food Scanner</Text>

      <View style={styles.row}>
        <Button mode="contained" onPress={takePhoto} style={styles.btn}>
          Take Photo
        </Button>
        <Button mode="outlined" onPress={pickFromGallery} style={styles.btn}>
          Gallery
        </Button>
      </View>

      {image && (
        <View style={styles.preview}>
          <Image source={{ uri: image.uri }} style={styles.image} resizeMode="cover" />
          <Text style={styles.meta}>
            {image.width ? `${image.width}×${image.height} • ` : ""}
            {image.uri.split("/").pop()}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={uploadToBackend}
          disabled={!image || uploading}
          style={styles.actionBtn}
        >
          {uploading ? "Analyzing..." : "Analyze Food"}
        </Button>

        <Button
          mode="outlined"
          onPress={() => {
            setImage(null);
            setResult(null);
          }}
          style={styles.actionBtn}
        >
          Reset
        </Button>
      </View>

      {uploading && (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Uploading & analyzing…</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Result</Text>
          <Text selectable>{JSON.stringify(result, null, 2)}</Text>
        </View>
      )}

      <Button mode="text" onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
        Back
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  btn: { flex: 1, marginHorizontal: 6 },
  preview: { alignItems: "center", marginVertical: 12 },
  image: { width: 260, height: 260, borderRadius: 8 },
  meta: { marginTop: 8, color: "#444" },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  actionBtn: { flex: 1, marginHorizontal: 6 },
  resultBox: { marginTop: 16, padding: 12, backgroundColor: "#f7fbff", borderRadius: 8 },
});
