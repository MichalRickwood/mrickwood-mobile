import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppScrollView } from "@/components/AppScroll";
import { AdminCard, AdminRow } from "@/components/AdminRow";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

/**
 * Veritra · Reporty — rozcestník. Čtyři reporty nad daty Veritry (zadání a nabídky
 * z evropských registrů), stejný obsah jako admin sekce na webu.
 */
export default function ReportyIndexScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.beta}>
          <Text style={styles.betaTitle}>{t("admin", "repBetaTitle")}</Text>
          <Text style={styles.betaBody}>{t("admin", "repBetaBody")}</Text>
        </View>
        <Text style={styles.intro}>{t("admin", "repIntro")}</Text>
        <AdminCard>
          <AdminRow
            label={t("admin", "repModelRow")}
            hint={t("admin", "repModelRowHint")}
            onPress={() => router.push("/(tabs)/reporty/model")}
          />
          <AdminRow
            label={t("admin", "repSubjektyRow")}
            hint={t("admin", "repSubjektyRowHint")}
            onPress={() => router.push("/(tabs)/reporty/subjekty/profil")}
          />
          <AdminRow
            label={t("admin", "repCenyRow")}
            hint={t("admin", "repCenyRowHint")}
            onPress={() => router.push("/(tabs)/reporty/cenove-hladiny")}
          />
          <AdminRow
            label={t("admin", "repKonkRow")}
            hint={t("admin", "repKonkRowHint")}
            onPress={() => router.push("/(tabs)/reporty/konkurence")}
          />
        </AdminCard>
        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    intro: { fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing.lg, lineHeight: 20 },
    beta: { borderWidth: 1, borderColor: colors.warning ?? colors.border, backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
    betaTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text, marginBottom: 4 },
    betaBody: { fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: 18 },
  });
