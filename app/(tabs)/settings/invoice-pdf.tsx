import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { WebView } from "react-native-webview";
import * as Sharing from "expo-sharing";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, spacing, type Colors } from "@/constants/theme";

/**
 * Inline PDF preview přes WKWebView. URI je file:// na cached PDF stažený
 * z /api/mobile/billing/invoices/[id]/pdf. Header má 'Sdílet' tlačítko pro
 * export do iOS share sheetu (Save to Files, Mail, atd.).
 */
export default function InvoicePdfScreen() {
  const { uri, title } = useLocalSearchParams<{ uri: string; title?: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title || t("settings", "billingInvoicesSection"),
      headerRight: () => (
        <Pressable
          onPress={async () => {
            if (!uri) return;
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                UTI: "com.adobe.pdf",
                dialogTitle: title,
              });
            }
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.shareIcon}>􀈂</Text>
        </Pressable>
      ),
    });
  }, [navigation, title, uri, t, styles, colors]);

  // Sanity check
  useEffect(() => {
    if (!uri) return;
  }, [uri]);

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t("settings", "loadFailed")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        style={styles.web}
        originWhitelist={["*"]}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    web: { flex: 1, backgroundColor: colors.bg },
    loading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    shareIcon: { fontSize: fontSize.xl, color: colors.link },
    errorText: { fontSize: fontSize.sm, color: colors.danger, padding: spacing.xl, textAlign: "center" },
  });
