import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

/** Fullscreen image preview pro tender attachmenty (JPG/PNG/...). v1 jen
 *  fit-to-screen; pinch zoom přidáme až bude požadavek. */
export default function DocImageScreen() {
  const { url, name } = useLocalSearchParams<{ url: string; name?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen
        options={{
          title: name ?? "Příloha",
          headerShown: true,
          headerBackTitle: "Zpět",
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontSize: fontSize.sm, fontWeight: "600" },
        }}
      />
      <View style={styles.imageWrap}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={styles.image}
            resizeMode="contain"
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        ) : null}
        {loading && !error && (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Obrázek se nepodařilo načíst.</Text>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Zpět</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (_colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#000" },
    imageWrap: { flex: 1, backgroundColor: "#000" },
    image: { flex: 1, width: "100%", height: "100%" },
    center: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: { color: "#fff", fontSize: fontSize.sm, marginBottom: spacing.lg },
    backBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: "#fff",
      borderRadius: 8,
    },
    backBtnText: { color: "#000", fontSize: fontSize.sm, fontWeight: "600" },
  });
