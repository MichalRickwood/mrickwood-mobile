/**
 * Nákupní modal pro Apple IAP (per-country předplatné).
 *
 * App Store 3.1.2(c): nákupní flow MUSÍ jasně ukázat název předplatného, délku
 * (měsíčně/ročně), cenu a FUNKČNÍ odkazy na Podmínky (EULA) + Ochranu osobních
 * údajů, plus disclosure o automatickém obnovení. `Alert.alert` to neumí (nejdou
 * klikací odkazy), proto tento modal.
 */
import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesStoreProduct } from "react-native-purchases";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AUTH_BASE_URL } from "@/lib/config";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  countryLabel: string;
  monthly: PurchasesStoreProduct | null;
  yearly: PurchasesStoreProduct | null;
  busy: boolean;
  onBuy: (product: PurchasesStoreProduct) => void;
  onClose: () => void;
}

export default function PurchaseModal({ visible, countryLabel, monthly, yearly, busy, onBuy, onClose }: Props) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const openLegal = (path: string) => void Linking.openURL(`${AUTH_BASE_URL}/${locale}/${path}`);

  const plan = (period: string, product: PurchasesStoreProduct) => (
    <Pressable
      key={product.identifier}
      disabled={busy}
      onPress={() => onBuy(product)}
      style={({ pressed }) => [styles.plan, pressed && !busy && { opacity: 0.7 }, busy && { opacity: 0.5 }]}
    >
      <Text style={styles.planPeriod}>{period}</Text>
      <Text style={styles.planPrice}>{product.priceString}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t("purchase", "title", { country: countryLabel })}</Text>
        <Text style={styles.value}>{t("purchase", "valueLine", { country: countryLabel })}</Text>

        <View style={styles.plans}>
          {monthly && plan(t("purchase", "monthly"), monthly)}
          {yearly && plan(t("purchase", "yearly"), yearly)}
        </View>

        {busy && <ActivityIndicator color={colors.text} style={{ marginTop: spacing.sm }} />}

        <Text style={styles.autoRenew}>{t("purchase", "autoRenew")}</Text>

        <View style={styles.legalRow}>
          <Text style={styles.legalLink} onPress={() => openLegal("vop")}>{t("purchase", "terms")}</Text>
          <Text style={styles.legalDot}>·</Text>
          <Text style={styles.legalLink} onPress={() => openLegal("gdpr")}>{t("purchase", "privacy")}</Text>
        </View>

        <Pressable disabled={busy} onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}>
          <Text style={styles.cancelText}>{t("purchase", "cancel")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    handle: { alignSelf: "center", width: 36, height: 4, borderRadius: radius.full, backgroundColor: c.border, marginBottom: spacing.md },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: c.text },
    value: { fontSize: fontSize.sm, color: c.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 20 },
    plans: { gap: spacing.sm },
    plan: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    planPeriod: { fontSize: fontSize.base, fontWeight: "600", color: c.text },
    planPrice: { fontSize: fontSize.base, fontWeight: "700", color: c.text },
    autoRenew: { fontSize: fontSize.xs, color: c.textSubtle, lineHeight: 17, marginTop: spacing.lg },
    legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
    legalLink: { fontSize: fontSize.xs, color: c.link, textDecorationLine: "underline" },
    legalDot: { fontSize: fontSize.xs, color: c.textFaint },
    cancel: { alignSelf: "center", marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    cancelText: { fontSize: fontSize.base, color: c.textMuted, fontWeight: "500" },
  });
}
