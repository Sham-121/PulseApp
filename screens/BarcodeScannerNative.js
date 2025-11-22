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
  Updated BarcodeScannerNative:
  - Moves Nutrition + Harmful ingredients above Ingredients
  - Adds a "Clear Saved Foods" button at the end with confirmation
  - Uses fallback local image path:
    /mnt/data/030b73a4-f7f2-407d-87cf-559d6fb201b6.png
*/

const FALLBACK_LOCAL_IMAGE = "/mnt/data/030b73a4-f7f2-407d-87cf-559d6fb201b6.png";
const SCAN_URL = "https://models.samsarawellness.in/barcode/scan";

function normalizePickerResult(res) {
  if (!res) return null;
  if (Array.isArray(res.assets) && res.assets.length > 0) {
    const a = res.assets[0];
    return {
      uri: a.uri,
      width: a.width,
      height: a.height,
      fileName: a.fileName || (a.uri ? a.uri.split("/").pop() : undefined),
      type: a.type || (a.uri && a.uri.endsWith(".png") ? "image/png" : "image/jpeg"),
    };
  }
  if (res.uri) {
    return {
      uri: res.uri,
      width: res.width,
      height: res.height,
      fileName: undefined,
      type: undefined,
    };
  }
  return null;
}

async function prepareImage(uri, maxWidth = 1600, compress = 0.8) {
  if (!uri || typeof uri !== "string") return null;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result;
  } catch (err) {
    console.warn("ImageManipulator failed; using original uri.", err?.message ?? err);
    return { uri };
  }
}

export default function BarcodeScannerNative({ navigation }) {
  const [image, setImage] = useState(null); // { uri, width, height, fileName, type }
  const [loading, setLoading] = useState(false);
  const [serverResult, setServerResult] = useState(null); // { method, status, body, when }
  const [savedFoods, setSavedFoods] = useState([]); // array of previews

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem("SAVED_BARCODES");
        if (s) setSavedFoods(JSON.parse(s));
      } catch (err) {
        console.warn("Failed reading saved foods:", err);
      }
    })();
  }, []);

  // Save a preview object for the Saved Foods list (keeps full 'body' for details)
  const saveResult = async (item) => {
    try {
      // item: { method, status, body, when }
      const b = item.body || {};
      const p = b.product || {};
      const preview = {
        when: item.when || new Date().toISOString(),
        barcode: b.barcode || p.barcode || null,
        title: p.product_name || p.name || (b.barcode ? `Barcode ${b.barcode}` : "Product"),
        image_url: p.image_url || null,
        body: b, // keep full payload for detail view
      };
      const newArr = [preview, ...savedFoods].slice(0, 50);
      setSavedFoods(newArr);
      await AsyncStorage.setItem("SAVED_BARCODES", JSON.stringify(newArr));
    } catch (err) {
      console.warn("Failed saving result:", err);
    }
  };

  // Clear saved foods with confirmation
  const clearSavedFoods = () => {
    Alert.alert("Clear saved scans", "Are you sure you want to remove all saved scans? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem("SAVED_BARCODES");
            setSavedFoods([]);
          } catch (err) {
            console.warn("Failed clearing saved foods:", err);
            Alert.alert("Error", "Could not clear saved scans. Try again.");
          }
        },
      },
    ]);
  };

  // Pick from gallery
  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if ((perm.status && perm.status !== "granted") || (perm.granted === false)) {
        Alert.alert("Permission required", "Please allow gallery access to choose an image.");
        return;
      }

      const mediaTypeConst =
        ImagePicker.MediaType?.Images ??
        ImagePicker.MediaTypeOptions?.Images ??
        ImagePicker.MediaTypeOptions;

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypeConst,
        quality: 1,
        base64: false,
      });

      if (res.canceled === true || res.cancelled === true) return;

      const normalized = normalizePickerResult(res);
      if (!normalized || !normalized.uri) {
        Alert.alert("No image", "Could not read the selected image. Try another image.");
        return;
      }

      const prepared = await prepareImage(normalized.uri);
      const final = prepared ? { ...prepared, fileName: normalized.fileName, type: normalized.type } : normalized;
      setImage(final);
      setServerResult(null);
    } catch (err) {
      console.error("pickFromGallery error:", err);
      Alert.alert("Error", "Failed to pick image. Try again.");
    }
  };

  // Take photo
  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if ((perm.status && perm.status !== "granted") || (perm.granted === false)) {
        Alert.alert("Permission required", "Please allow camera access to take a photo.");
        return;
      }

      const mediaTypeConst =
        ImagePicker.MediaType?.Images ??
        ImagePicker.MediaTypeOptions?.Images ??
        ImagePicker.MediaTypeOptions;

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: mediaTypeConst,
        quality: 1,
        base64: false,
      });

      if (res.canceled === true || res.cancelled === true) return;

      const normalized = normalizePickerResult(res);
      if (!normalized || !normalized.uri) {
        Alert.alert("Camera failed", "Could not capture image. Try again.");
        return;
      }

      const prepared = await prepareImage(normalized.uri);
      const final = prepared ? { ...prepared, fileName: normalized.fileName, type: normalized.type } : normalized;
      setImage(final);
      setServerResult(null);
    } catch (err) {
      console.error("takePhoto error:", err);
      Alert.alert("Error", "Failed to take photo. Try again.");
    }
  };

  // Upload image as base64 JSON to SCAN_URL
  const uploadImage = async () => {
    if (!image || !image.uri) {
      Alert.alert("No image selected", "Tap 'Choose Image' to pick or take a barcode photo.");
      return;
    }

    setLoading(true);
    setServerResult(null);

    try {
      const uri = image.uri;
      if (!uri || typeof uri !== "string") throw new Error("Invalid image URI");

      // get base64 via ImageManipulator (resize + compress + base64)
      let manipResult = null;
      try {
        manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
      } catch (err) {
        console.warn("manipulateAsync with resize failed, trying base64-only:", err?.message ?? err);
        manipResult = await ImageManipulator.manipulateAsync(uri, [], {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
      }

      if (!manipResult || !manipResult.base64) {
        throw new Error("Failed to convert image to base64");
      }

      const dataUrl = `data:image/jpeg;base64,${manipResult.base64}`;

      const resp = await fetch(SCAN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Server returned ${resp.status}: ${text}`);
      }

      let parsed;
      try {
        parsed = await resp.json();
      } catch {
        parsed = { rawText: await resp.text().catch(() => "") };
      }

      const out = { method: "scan_json", status: resp.status, body: parsed, when: new Date().toISOString() };
      setServerResult(out);
      await saveResult(out);
    } catch (err) {
      console.error("uploadImage error:", err);
      Alert.alert("Upload failed", err.message || "Network or server error");
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setImage(null);
    setServerResult(null);
  };

  // Helper: determine veg / non-veg / unknown
  const detectVegStatus = (product = {}) => {
    const analysis = (product.harmful_ingredients_analysis || "").toString();
    const labels = (product.labels || "").toString();
    const name = (product.product_name || product.name || "").toString();
    const combined = (analysis + " " + labels + " " + name).toLowerCase();

    if (/non[-\s]?veg|non[-\s]?vegetarian|nonveg|non vegetarian|contains meat|contains chicken|contains egg|contains fish|contains mutton/i.test(combined)) {
      return "non-veg";
    }
    if (/vegetarian|veg\b|pure veg|suitable for vegetarians|veg\/veg|vegan/i.test(combined)) {
      return "veg";
    }
    return "unknown";
  };

  // Helper: extract potential allergens from harmful_ingredients_analysis or product.allergens
  const extractAllergens = (product = {}) => {
    if (product.allergens && product.allergens.toString().trim()) {
      return product.allergens.toString();
    }
    const analysis = product.harmful_ingredients_analysis || "";
    if (!analysis) return "";
    const m = /Potential Allergens:\s*([^.\n\r]+)/i.exec(analysis);
    if (m && m[1]) return m[1].trim();
    const m2 = /Potential Allergens:\s*([\s\S]+)/i.exec(analysis);
    if (m2 && m2[1]) {
      return m2[1].split(/[\n\r]/)[0].trim();
    }
    return "";
  };

  // Helper: extract harmful ingredients analysis (final section)
  const extractHarmfulAnalysis = (product = {}) => {
    const analysis = product.harmful_ingredients_analysis || product.harmful_ingredients || product.harmful_ingredients_info || "";
    return analysis ? analysis.toString() : "";
  };

  // Pretty product render: shows veg badge + allergens on top + nutrition/harmful above ingredients
  const renderProduct = (body) => {
    if (!body) return null;
    const product = body.product || body;
    const barcode = body.barcode || (product && product.barcode);
    const name = product.product_name || product.name || product.title || "Unknown product";
    const brand = product.brands || product.brand || "";
    const imageUrl = product.image_url || product.image || FALLBACK_LOCAL_IMAGE;
    const ingredients = product.ingredients_text || product.ingredients || "";
    const allergens = extractAllergens(product);
    const categories = product.categories || "";
    const nutrition = product.nutrition_facts || product.nutrition || {};
    const vegStatus = detectVegStatus(product);
    const harmfulAnalysis = extractHarmfulAnalysis(product);

    const badgeStyle =
      vegStatus === "veg"
        ? { backgroundColor: "#e6f9ea", color: "#1a7f2e", label: "Veg" }
        : vegStatus === "non-veg"
        ? { backgroundColor: "#fdecea", color: "#b32121", label: "Non-Veg" }
        : { backgroundColor: "#f0f0f0", color: "#666", label: "Unknown" };

    // Only show nutrition rows where value !== 0 (numeric) and not null/undefined.
    const getNutritionRow = (label, key) => {
      const v = nutrition && nutrition[key];
      if (v === null || v === undefined) return null;
      const num = Number(v);
      if (!isNaN(num)) {
        if (num === 0) return null; // hide zeros
        return (
          <View style={styles.nRow} key={key}>
            <Text style={styles.nLabel}>{label}</Text>
            <Text style={styles.nValue}>{String(v)}</Text>
          </View>
        );
      }
      if (String(v).trim() === "") return null;
      return (
        <View style={styles.nRow} key={key}>
          <Text style={styles.nLabel}>{label}</Text>
          <Text style={styles.nValue}>{String(v)}</Text>
        </View>
      );
    };

    return (
      <Card style={{ marginTop: 8 }}>
        <Card.Content>
          {/* Top row: badge + title */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Image source={{ uri: imageUrl }} style={styles.productImage} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "700" }} numberOfLines={2}>
                  {name}
                </Text>
                {brand ? <Text style={{ color: "#666", marginTop: 4 }}>{brand}</Text> : null}
                {barcode ? <Text style={{ color: "#666", marginTop: 6 }}>Barcode: {barcode}</Text> : null}
                {categories ? <Text style={{ color: "#666", marginTop: 6, fontSize: 12 }}>{categories}</Text> : null}
              </View>
            </View>

            <View style={{ marginLeft: 8 }}>
              <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
                <Text style={{ color: badgeStyle.color, fontWeight: "700" }}>{badgeStyle.label}</Text>
              </View>
            </View>
          </View>

          {/* Allergens (prominent) */}
          {allergens ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: "700", color: "#b30" }}>Allergens</Text>
              <Text style={{ marginTop: 6, color: "#333" }}>{allergens}</Text>
            </View>
          ) : null}

          {/* Nutrition (moved above Ingredients) */}
          {nutrition && Object.keys(nutrition).length > 0 ? (
            <>
              <Text style={{ marginTop: 12, fontWeight: "700" }}>Nutrition (per serving / 100g)</Text>
              <View style={styles.nTable}>
                {getNutritionRow("Energy (kcal)", "energy_kcal")}
                {getNutritionRow("Calories", "calories")}
                {getNutritionRow("Carbs (g)", "carbohydrates")}
                {getNutritionRow("Fat (g)", "fat")}
                {getNutritionRow("Saturated fat (g)", "saturated_fat")}
                {getNutritionRow("Protein (g)", "proteins")}
                {getNutritionRow("Sugar (g)", "sugars")}
                {getNutritionRow("Fiber (g)", "fiber")}
                {getNutritionRow("Salt (g)", "salt")}
                {getNutritionRow("Sodium (mg)", "sodium")}
              </View>
            </>
          ) : null}

          {/* Harmful ingredients analysis (moved above Ingredients) */}
          {harmfulAnalysis ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: "700", color: "#a00" }}>Harmful ingredients analysis</Text>
              <Text style={{ marginTop: 6, color: "#333", lineHeight: 18 }}>{harmfulAnalysis}</Text>
            </View>
          ) : null}

          {/* Ingredients (now after nutrition + harmful analysis) */}
          {ingredients ? (
            <>
              <Text style={{ marginTop: 12, fontWeight: "700" }}>Ingredients</Text>
              <Text style={{ marginTop: 6, color: "#333", lineHeight: 18 }}>{ingredients}</Text>
            </>
          ) : null}
        </Card.Content>
      </Card>
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
              {image.uri ? (
                <Image source={{ uri: image.uri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, { justifyContent: "center", alignItems: "center" }]}>
                  <Text>No preview available</Text>
                </View>
              )}

              <Paragraph style={{ marginTop: 8 }}>
                {image.width ? `${image.width}×${image.height} • ` : ""}
                {image.uri ? image.uri.split("/").pop() : "unknown.jpg"}
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
            <Paragraph>Choose Image or Take Photo and then tap Scan Barcode.</Paragraph>
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

      {/* Server result display (pretty only) */}
      {serverResult && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700" }}>Result</Text>
          {renderProduct(serverResult.body)}
        </View>
      )}

      {/* Saved Foods */}
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontWeight: "700" }}>Saved Foods</Text>
        {savedFoods.length === 0 ? (
          <Paragraph style={{ marginTop: 8, color: "#666" }}>No saved scans yet.</Paragraph>
        ) : (
          savedFoods.map((s, idx) => {
            const title = s.title || (s.body && (s.body.product?.product_name || s.body.product?.name)) || `Saved ${idx + 1}`;
            return (
              <Card key={idx} style={{ marginTop: 8, padding: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {s.image_url ? (
                    <Image source={{ uri: s.image_url }} style={{ width: 48, height: 48, borderRadius: 6 }} />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: "#eee", justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ color: "#666", fontSize: 12 }}>No Img</Text>
                    </View>
                  )}

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontWeight: "700" }}>{title}</Text>
                    <Text style={{ color: "#666", marginTop: 4, fontSize: 12 }}>{new Date(s.when).toLocaleString()}</Text>
                  </View>
                  <Button
                    mode="text"
                    onPress={() => {
                      // show details for this saved item by setting serverResult
                      setServerResult({ body: s.body, when: s.when, status: s.status || 200, method: s.method || "saved" });
                    }}
                  >
                    View
                  </Button>
                </View>
              </Card>
            );
          })
        )}

        {/* Clear saved foods button */}
        {savedFoods.length > 0 && (
          <View style={{ marginTop: 12, alignItems: "center" }}>
            <Button mode="contained" onPress={clearSavedFoods} style={{ backgroundColor: "#d9534f" }}>
              Clear Saved Foods
            </Button>
          </View>
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
  productImage: { width: 92, height: 92, borderRadius: 8, backgroundColor: "#fafafa" },
  nTable: { marginTop: 8, padding: 8, backgroundColor: "#f8f5f7", borderRadius: 8 },
  nRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  nLabel: { color: "#333" },
  nValue: { color: "#111", fontWeight: "700" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
