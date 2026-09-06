import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Paywall záložky Reporty. Reporty (cenové hladiny, konkurence, profily firem, model)
 * jsou placená služba; dnes k nim má přístup jen účet s rolí ADMIN, ostatním se místo
 * obsahu ukáže tahle obrazovka s cestou k předplatnému. Až bude služba prodejná,
 * rozhodne o přístupu entitlement ze serveru, ne role.
 */
export default function ReportyPaywall({ onRecheck, onActivated }: { onRecheck?: () => void; onActivated?: () => void } = {}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stav, setStav] = useState<"klid" | "bezi" | "hotovo" | "chyba">("klid");

  // Aktivace testovací verze: server založí službu REPORTS (bez konce) a pošle děkovný e-mail.
  async function aktivovat() {
    setStav("bezi");
    try {
      await api.post("/api/v2/reporty/aktivace", {});
      setStav("hotovo");
      onActivated?.();
    } catch {
      setStav("chyba");
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>🚧</Text>
      </View>
      <Text style={styles.title}>{t("admin", "repPaywallTitle")}</Text>
      <Text style={styles.body}>{t("admin", "repPaywallBody")}</Text>
      <Text style={styles.body}>{t("admin", "repPaywallContact")}</Text>
      <Pressable
        onPress={() => void aktivovat()}
        disabled={stav === "bezi" || stav === "hotovo"}
        style={({ pressed }) => [styles.btnPrimary, (pressed || stav !== "klid") && { opacity: 0.85 }]}
      >
        <Text style={styles.btnPrimaryText}>
          {stav === "bezi" ? t("admin", "repActivating") : stav === "hotovo" ? t("admin", "repActivated") : t("admin", "repPaywallWrite")}
        </Text>
      </Pressable>
      {stav === "chyba" ? <Text style={styles.fineprint}>{t("admin", "repActivateError")}</Text> : null}
      {onRecheck ? (
        <Pressable onPress={onRecheck} style={({ pressed }) => [styles.recheckBtn, pressed && { opacity: 0.6 }]}>
          <Text style={styles.recheckText}>{t("filters", "paywallRecheckBtn")}</Text>
        </Pressable>
      ) : null}
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
    recheckBtn: { paddingVertical: spacing.md, alignItems: "center", alignSelf: "stretch" },
    recheckText: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
    fineprint: { fontSize: fontSize.xs, color: colors.textFaint, textAlign: "center", paddingHorizontal: spacing.md, marginTop: spacing.md },
  });
