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

/* Updated BarcodeScannerNative:
   - Automatically clears saved foods older than 24 hours
   - Removes manual "Clear Saved Foods" button
*/

const FALLBACK_LOCAL_IMAGE = "/mnt/data/030b73a4-f7f2-407d-87cf-559d6fb201b6.png";
const SCAN_URL = "https://models.samsarawellness.in/barcode/scan";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

// Helper function to filter out foods older than 24 hours
function filterRecentFoods(foodsArray) {
  const now = Date.now();
  return foodsArray.filter((item) => {
    if (!item.when) return false;
    const itemTime = new Date(item.when).getTime();
    return (now - itemTime) < TWENTY_FOUR_HOURS;
  });
}

export default function BarcodeScannerNative({ navigation }) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverResult, setServerResult] = useState(null);
  const [savedFoods, setSavedFoods] = useState([]);

  // Load saved foods and automatically filter out items older than 24 hours
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem("SAVED_BARCODES");
        if (s) {
          const allFoods = JSON.parse(s);
          const recentFoods = filterRecentFoods(allFoods);
          
          // If we filtered out any items, update storage
          if (recentFoods.length !== allFoods.length) {
            await AsyncStorage.setItem("SAVED_BARCODES", JSON.stringify(recentFoods));
          }
          
          setSavedFoods(recentFoods);
        }
      } catch (err) {
        console.warn("Failed reading saved foods:", err);
      }
    })();
  }, []);

  // Save a preview object for the Saved Foods list
  const saveResult = async (item) => {
    try {
      const b = item.body || {};
      const p = b.product || {};
      const preview = {
        when: item.when || new Date().toISOString(),
        barcode: b.barcode || p.barcode || null,
        title: p.product_name || p.name || (b.barcode ? `Barcode ${b.barcode}` : "Product"),
        image_url: p.image_url || null,
        body: b,
      };
      
      // Filter recent foods before adding new one
      const recentFoods = filterRecentFoods(savedFoods);
      const newArr = [preview, ...recentFoods].slice(0, 50);
      
      setSavedFoods(newArr);
      await AsyncStorage.setItem("SAVED_BARCODES", JSON.stringify(newArr));
    } catch (err) {
      console.warn("Failed saving result:", err);
    }
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if ((perm.status && perm.status !== "granted") || (perm.granted === false)) {
        Alert.alert("Permission required", "Please allow gallery access to choose an image.");
        return;
      }
      const mediaTypeConst = ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions?.Images ?? ImagePicker.MediaTypeOptions;
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

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if ((perm.status && perm.status !== "granted") || (perm.granted === false)) {
        Alert.alert("Permission required", "Please allow camera access to take a photo.");
        return;
      }
      const mediaTypeConst = ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions?.Images ?? ImagePicker.MediaTypeOptions;
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

      const out = {
        method: "scan_json",
        status: resp.status,
        body: parsed,
        when: new Date().toISOString()
      };
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

  const extractHarmfulAnalysis = (product = {}) => {
    const analysis = product.harmful_ingredients_analysis || product.harmful_ingredients || product.harmful_ingredients_info || "";
    return analysis ? analysis.toString() : "";
  };

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

    const badgeStyle = vegStatus === "veg"
      ? { backgroundColor: "#e6f9ea", color: "#1a7f2e", label: "Veg" }
      : vegStatus === "non-veg"
      ? { backgroundColor: "#fdecea", color: "#b32121", label: "Non-Veg" }
      : { backgroundColor: "#f0f0f0", color: "#666", label: "Unknown" };

    const getNutritionRow = (label, key) => {
      const v = nutrition && nutrition[key];
      if (v === null || v === undefined) return null;
      const num = Number(v);
      if (!isNaN(num)) {
        if (num === 0) return null;
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
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="contain" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>{name}</Text>
            {brand ? <Text style={{ color: "#555", marginBottom: 2 }}>{brand}</Text> : null}
            {barcode ? <Text style={{ color: "#777", fontSize: 12 }}>Barcode: {barcode}</Text> : null}
            {categories ? <Text style={{ color: "#777", fontSize: 12 }}>{categories}</Text> : null}
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor, alignSelf: "flex-start" }]}>
          <Text style={{ color: badgeStyle.color, fontWeight: "700" }}>{badgeStyle.label}</Text>
        </View>

        {allergens ? (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: "#fff3cd", borderRadius: 8 }}>
            <Text style={{ fontWeight: "700", marginBottom: 4 }}>Allergens</Text>
            <Text style={{ color: "#856404" }}>{allergens}</Text>
          </View>
        ) : null}

        {nutrition && Object.keys(nutrition).length > 0 ? (
          <>
            <Text style={{ fontWeight: "700", marginTop: 16, marginBottom: 4 }}>Nutrition (per serving / 100g)</Text>
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

        {harmfulAnalysis ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: "700", marginBottom: 4 }}>Harmful ingredients analysis</Text>
            <Paragraph>{harmfulAnalysis}</Paragraph>
          </View>
        ) : null}

        {ingredients ? (
          <>
            <Text style={{ fontWeight: "700", marginTop: 16, marginBottom: 4 }}>Ingredients</Text>
            <Paragraph>{ingredients}</Paragraph>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Food Barcode Scanner</Text>
      <Text style={styles.subtitle}>
        Upload a photo of any food barcode to get nutritional information.
      </Text>

      <View style={styles.selectorRow}>
        <Button mode="contained" onPress={pickFromGallery} style={styles.btn}>
          Choose Image
        </Button>
        <Button mode="contained" onPress={takePhoto} style={styles.btn}>
          Take Photo
        </Button>
      </View>

      {image ? (
        <Card style={{ marginTop: 16 }}>
          <Card.Content>
            {image.uri ? (
              <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <Text>No preview available</Text>
            )}
            <Paragraph style={{ marginTop: 8 }}>
              {image.width ? `${image.width}×${image.height} • ` : ""}
              {image.uri ? image.uri.split("/").pop() : "unknown.jpg"}
            </Paragraph>
          </Card.Content>
          <Card.Actions>
            <Button onPress={uploadImage}>Scan Barcode</Button>
            <Button onPress={clearSelection}>Clear</Button>
          </Card.Actions>
        </Card>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <Card.Content>
            <Paragraph>Choose Image or Take Photo and then tap Scan Barcode.</Paragraph>
            <Paragraph style={{ marginTop: 6 }}>After choosing, tap Scan Barcode.</Paragraph>
          </Card.Content>
        </Card>
      )}

      {loading && (
        <Card style={{ marginTop: 16 }}>
          <Card.Content style={{ alignItems: "center" }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 12 }}>Scanning barcode and fetching nutrition data...</Text>
          </Card.Content>
        </Card>
      )}

      {serverResult && (
        <Card style={{ marginTop: 16 }}>
          <Card.Content>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Result</Text>
            {renderProduct(serverResult.body)}
          </Card.Content>
        </Card>
      )}

      <Card style={{ marginTop: 24 }}>
        <Card.Content>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Saved Foods</Text>
          {savedFoods.length === 0 ? (
            <Paragraph>No saved scans yet.</Paragraph>
          ) : (
            savedFoods.map((s, idx) => {
              const title = s.title || (s.body && (s.body.product?.product_name || s.body.product?.name)) || `Saved ${idx + 1}`;
              return (
                <Card key={idx} style={{ marginBottom: 12 }}>
                  <Card.Content style={{ flexDirection: "row", alignItems: "center" }}>
                    {s.image_url ? (
                      <Image source={{ uri: s.image_url }} style={{ width: 60, height: 60, borderRadius: 6 }} resizeMode="contain" />
                    ) : (
                      <View style={{ width: 60, height: 60, backgroundColor: "#eee", borderRadius: 6, justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 10 }}>No Img</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: "700" }}>{title}</Text>
                      <Text style={{ fontSize: 12, color: "#666" }}>{new Date(s.when).toLocaleString()}</Text>
                    </View>
                  </Card.Content>
                  <Card.Actions>
                    <Button
                      onPress={() => {
                        setServerResult({
                          body: s.body,
                          when: s.when,
                          status: s.status || 200,
                          method: s.method || "saved"
                        });
                      }}
                    >
                      View
                    </Button>
                  </Card.Actions>
                </Card>
              );
            })
          )}
        </Card.Content>
      </Card>
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
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, justifyContent: "center", alignItems: "center" },
});