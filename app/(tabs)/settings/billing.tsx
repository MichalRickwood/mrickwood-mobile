import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/lib/api";
import { endpoints, type BillingSummary } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { API_BASE_URL } from "@/lib/config";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

export default function BillingScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await endpoints.getBilling();
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("settings", "loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? t("settings", "loadFailed")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const planLabel =
    data.tier === "PAID" ? t("settings", "billingPlanPaid") : t("settings", "billingPlanFree");
  const stateLabel = data.state ? stateToLabel(data.state, t) : null;
  const cycleLabel = data.cycle ? cycleToLabel(data.cycle, t) : null;
  const dateLocale = LOCALE_MAP[locale] ?? "cs-CZ";

  function openWebBilling() {
    const url = `${API_BASE_URL}/${locale}/dashboard/settings?tab=billing`;
    void Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Row styles={styles} label={t("settings", "billingPlanLabel")} value={planLabel} />
          {stateLabel && (
            <>
              <View style={styles.separator} />
              <Row styles={styles} label={t("settings", "billingStateLabel")} value={stateLabel} />
            </>
          )}
          {cycleLabel && (
            <>
              <View style={styles.separator} />
              <Row styles={styles} label={t("settings", "billingCycleLabel")} value={cycleLabel} />
            </>
          )}
          {data.trialEndsAt && data.state === "TRIAL" && (
            <>
              <View style={styles.separator} />
              <Row
                styles={styles}
                label={t("settings", "billingTrialEndsLabel")}
                value={formatDate(data.trialEndsAt, dateLocale)}
              />
            </>
          )}
          {data.paidUntil && data.tier === "PAID" && (
            <>
              <View style={styles.separator} />
              <Row
                styles={styles}
                label={t("settings", "billingPaidUntilLabel")}
                value={formatDate(data.paidUntil, dateLocale)}
              />
            </>
          )}
        </View>

        {data.cancelAtPeriodEnd && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t("settings", "billingCancelNotice")}</Text>
          </View>
        )}

        <Pressable
          onPress={openWebBilling}
          style={({ pressed }) => [styles.webButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.webButtonText}>{t("settings", "billingManageOnWeb")}</Text>
        </Pressable>
        <Text style={styles.webHint}>{t("settings", "billingManageOnWebHint")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

type TFn = ReturnType<typeof useI18n>["t"];

function stateToLabel(state: NonNullable<BillingSummary["state"]>, t: TFn): string {
  switch (state) {
    case "TRIAL":
      return t("settings", "billingStateTrial");
    case "ACTIVE":
      return t("settings", "billingStateActive");
    case "PAST_DUE":
      return t("settings", "billingStatePastDue");
    case "SUSPENDED":
      return t("settings", "billingStateSuspended");
    case "CANCELED":
      return t("settings", "billingStateCanceled");
  }
}

function cycleToLabel(cycle: NonNullable<BillingSummary["cycle"]>, t: TFn): string {
  return cycle === "MONTHLY" ? t("settings", "billingCycleMonthly") : t("settings", "billingCycleYearly");
}

function formatDate(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    rowLabel: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    rowValue: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
    notice: {
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.warningBg,
      borderRadius: radius.md,
    },
    noticeText: { fontSize: fontSize.sm, color: colors.warning, lineHeight: 18 },
    webButton: {
      marginTop: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    buttonPressed: { opacity: 0.7 },
    webButtonText: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    webHint: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 16,
    },
    errorText: { fontSize: fontSize.sm, color: colors.danger, textAlign: "center" },
  });
