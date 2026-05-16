import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useTheme } from "@/lib/theme-context";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/auth-storage";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/** HTML preview pro Office dokumenty (DOCX zatím). Endpoint server-side
 *  konvertuje + cachuje na Spaces a vrací 302 na signed URL. WebView pošle
 *  Bearer jen pro initial GET; redirect na Spaces už auth nemá ani nepotřebuje. */
export default function DocHtmlScreen() {
  const { url, name, kind } = useLocalSearchParams<{
    url: string;
    name?: string;
    kind?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const tk = await getToken();
      setToken(tk);
      setTokenLoaded(true);
    })();
  }, []);

  if (!url) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: name ?? "Příloha", headerShown: true, headerBackTitle: "Zpět" }} />
        <View style={styles.center}>
          <Text style={styles.errText}>Chybí URL dokumentu.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const previewUrl = `${API_BASE_URL}/api/mobile/document-preview?url=${encodeURIComponent(url)}&kind=${encodeURIComponent(kind ?? "docx")}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen
        options={{
          title: name ?? "Příloha",
          headerShown: true,
          headerBackTitle: "Zpět",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: fontSize.sm, fontWeight: "600" },
        }}
      />
      {!tokenLoaded || !token ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errTitle}>Nepodařilo se zobrazit</Text>
          <Text style={styles.errText}>{error}</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Zpět</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          source={{
            uri: previewUrl,
            headers: { Authorization: `Bearer ${token}` },
          }}
          style={[styles.webview, { backgroundColor: colors.bg }]}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.textSubtle} />
            </View>
          )}
          onHttpError={(e) => {
            const status = e.nativeEvent.statusCode;
            if (status >= 400) {
              setError(`HTTP ${status}`);
            }
          }}
          onError={(e) => setError(e.nativeEvent.description ?? "WebView error")}
          // Force background match so flash při loadu není bílý v dark mode.
          containerStyle={{ backgroundColor: colors.bg }}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    webview: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    errTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
    errText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", marginBottom: spacing.lg },
    backBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    backBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
  });
