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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Signed URL hotového náhledu — získává se pollingem (nowait), viz níže.
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const tk = await getToken();
      setToken(tk);
      setTokenLoaded(true);
    })();
  }, []);

  // Polling konverze: server u portálů blokujících DC IP (NEN…) stahuje přes worker,
  // což na první otevření trvá i desítky sekund — blokující request by WebView/fetch
  // timeoutnul. nowait=1 → 202 {pending} dokud není hotovo, pak {url} (signed Spaces).
  useEffect(() => {
    if (!token || !url) return;
    let cancelled = false;
    const pollUrl = `${API_BASE_URL}/api/v2/leads/documents/preview?url=${encodeURIComponent(url)}&kind=${encodeURIComponent(kind ?? "docx")}&redirect=json&nowait=1`;
    (async () => {
      for (let i = 0; i < 45; i++) {
        let res: Response | null = null;
        try {
          res = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
        } catch {
          /* síť — zkusíme znovu */
        }
        if (cancelled) return;
        if (res?.status === 200) {
          const j = (await res.json().catch(() => null)) as { url?: string } | null;
          if (j?.url) { setSignedUrl(j.url); return; }
        } else if (res && res.status !== 202) {
          setError(`HTTP ${res.status}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
        if (cancelled) return;
      }
      setError(t("feedback", "docPreviewTimeout"));
    })();
    return () => {
      cancelled = true;
    };
  }, [token, url, kind, t]);

  if (!url) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: name ?? t("feedback", "docPreviewTitle"), headerShown: true, headerBackTitle: t("settings", "back") }} />
        <View style={styles.center}>
          <Text style={styles.errText}>{t("feedback", "docPreviewMissingUrl")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen
        options={{
          title: name ?? t("feedback", "docPreviewTitle"),
          headerShown: true,
          headerBackTitle: t("settings", "back"),
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: fontSize.sm, fontWeight: "600" },
        }}
      />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errTitle}>{t("feedback", "docPreviewErrorTitle")}</Text>
          <Text style={styles.errText}>{error}</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t("settings", "back")}</Text>
          </Pressable>
        </View>
      ) : !signedUrl ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.textSubtle} />
          <Text style={styles.loadingText}>{t("feedback", "docPreviewPreparing")}</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: signedUrl }}
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
    // Opticky vycentrováno: geometrický střed působí (s headerem nahoře) příliš nízko →
    // obsah zvedáme paddingBottom o ~1/4 výšky.
    loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, paddingBottom: "30%" },
    loadingText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", marginTop: spacing.lg },
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
