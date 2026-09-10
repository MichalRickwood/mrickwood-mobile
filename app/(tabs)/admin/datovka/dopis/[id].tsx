import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AdminCard } from "@/components/AdminRow";
import { adminApi } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { prepnoutVyrazeni, useVyrazene } from "@/lib/isds/vyrazene";
import { STUPEN_KLIC, formatCastka, formatDatum } from "@/lib/vymahani-format";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Detail navrženého dopisu — celé znění, příjemce, zakázka a odkaz na PDF.
 * Data bere z téže dávky jako seznam (sdílená cache), aby se text nemusel
 * stahovat znovu.
 */
export default function DatovkaDopisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dopisId = Number(id);
  const router = useRouter();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const vyrazene = useVyrazene();

  const davka = useQuery({
    queryKey: ["ds-davka"],
    queryFn: ({ signal }) => adminApi.getVymahaniDavka(signal),
  });
  const dopis = davka.data?.dopisy.find((d) => d.id === dopisId);

  if (davka.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      </SafeAreaView>
    );
  }
  if (!dopis) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Text style={styles.prazdno}>{t("admin", "dsChybaNacteni")}</Text>
      </SafeAreaView>
    );
  }

  const vyrazeny = vyrazene.has(dopis.id);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ {t("admin", "back")}</Text>
        </Pressable>

        <View style={styles.headRow}>
          <Text style={styles.badge}>
            {t("admin", "dsStupenLabel", { n: dopis.stupen })} · {t("admin", STUPEN_KLIC[dopis.stupen] ?? "dsStupen1")}
          </Text>
          <Text style={styles.spoustec}>
            {t("admin", dopis.spoustec === "smlouva_v_registru" ? "dsSpoustecSmlouva" : "dsSpoustec3m")}
          </Text>
        </View>

        <Text style={styles.predmet}>{dopis.predmet}</Text>

        <AdminCard style={styles.card}>
          <Text style={styles.label}>{t("admin", "dsPrijemce")}</Text>
          <Text style={styles.hodnota}>{dopis.prijemce.nazev}</Text>
          <Text style={styles.meta}>
            IČO {dopis.prijemce.ico} · {dopis.prijemce.databoxId}
            {dopis.prijemce.typ ? ` · ${dopis.prijemce.typ}` : ""}
          </Text>

          <Text style={styles.label}>{t("admin", "dsZakazka")}</Text>
          <Text style={styles.hodnota}>{dopis.zakazka.nazev}</Text>
          <Text style={styles.meta}>
            {formatCastka(dopis.zakazka.hodnota, locale)}
            {dopis.zakazka.lhutaAt ? ` · ${t("admin", "dsLhuta")} ${formatDatum(dopis.zakazka.lhutaAt, locale)}` : ""}
          </Text>
          {!!dopis.zakazka.url && (
            <Pressable onPress={() => void WebBrowser.openBrowserAsync(dopis.zakazka.url!)}>
              <Text style={styles.odkaz}>{t("admin", "dsOtevritZakazku")}</Text>
            </Pressable>
          )}

          <Text style={styles.label}>{t("admin", "dsZnacka")}</Text>
          <Text style={styles.hodnota}>{dopis.naseZnacka}</Text>
        </AdminCard>

        <AdminCard style={styles.card}>
          <Text style={styles.label}>{t("admin", "dsTextDopisu")}</Text>
          <Text style={styles.text}>{dopis.text}</Text>
        </AdminCard>

        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(dopis.pdfUrl)}
          style={[styles.btn, styles.btnPrimary]}
        >
          <Text style={[styles.btnText, styles.btnTextPrimary]}>{t("admin", "dsOtevritPdf")}</Text>
        </Pressable>

        <Pressable onPress={() => prepnoutVyrazeni(dopis.id)} style={styles.btn}>
          <Text style={[styles.btnText, vyrazeny ? styles.btnTextWarn : styles.btnTextDanger]}>
            {vyrazeny ? t("admin", "dsVratit") : t("admin", "dsVyradit")}
          </Text>
        </Pressable>
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    spinner: { marginTop: spacing.xxl },
    prazdno: { fontSize: fontSize.base, color: colors.textSubtle, textAlign: "center", marginTop: spacing.xxl },
    back: { fontSize: fontSize.base, color: colors.link, marginBottom: spacing.md },
    headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    badge: {
      fontSize: fontSize.xs,
      fontWeight: "700",
      color: colors.accentForeground,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    spoustec: { fontSize: fontSize.xs, color: colors.textSubtle, flex: 1 },
    predmet: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginVertical: spacing.md },
    card: { padding: spacing.lg },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.md, marginBottom: 2 },
    hodnota: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    odkaz: { fontSize: fontSize.sm, color: colors.link, marginTop: spacing.xs, fontWeight: "600" },
    text: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 21, marginTop: spacing.xs },
    btn: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    btnText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    btnTextPrimary: { color: colors.accentForeground },
    btnTextDanger: { color: colors.danger },
    btnTextWarn: { color: colors.warning },
  });
