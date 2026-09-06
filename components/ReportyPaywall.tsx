import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { isIapAvailable } from "@/lib/iap";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Paywall záložky Reporty. Reporty (cenové hladiny, konkurence, profily firem, model)
 * jsou placená služba; dnes k nim má přístup jen účet s rolí ADMIN, ostatním se místo
 * obsahu ukáže tahle obrazovka s cestou k předplatnému. Až bude služba prodejná,
 * rozhodne o přístupu entitlement ze serveru, ne role.
 */
export default function ReportyPaywall() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>🔒</Text>
      </View>
      <Text style={styles.title}>{t("admin", "repPaywallTitle")}</Text>
      <Text style={styles.body}>{t("admin", "repPaywallBody")}</Text>
      <View style={styles.list}>
        {[t("admin", "repCenyRow"), t("admin", "repKonkRow"), t("admin", "repSubjektyRow"), t("admin", "repModelRow")].map((x) => (
          <Text key={x} style={styles.listItem}>
            • {x}
          </Text>
        ))}
      </View>
      {isIapAvailable() ? (
        <Pressable
          onPress={() => router.push("/(tabs)/settings/billing")}
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnPrimaryText}>{t("onboardingCountries", "subscribe")}</Text>
        </Pressable>
      ) : (
        <Text style={styles.fineprint}>{t("admin", "repPaywallContact")}</Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center" },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    iconText: { fontSize: 28 },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: spacing.md },
    body: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    list: { alignSelf: "stretch", marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
    listItem: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },
    btnPrimary: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignSelf: "stretch",
      alignItems: "center",
    },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    fineprint: { fontSize: fontSize.xs, color: colors.textFaint, textAlign: "center", paddingHorizontal: spacing.md },
  });
