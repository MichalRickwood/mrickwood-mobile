import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Paywall pro LEADS službu — zobrazí se v Zakázkách tabu když /api/mobile/matches
 * vrátí 402. Loaduje status služby; pokud user nikdy neměl trial → tlačítko
 * aktivace, jinak → CTA do nastavení předplatného (karta/fa flow).
 */
export default function LeadsPaywall() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["service", "leads"],
    queryFn: () => endpoints.getLeadsService(),
  });

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["service", "leads"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["filters"] }),
    ]);
  }

  const activate = useMutation({
    mutationFn: () => endpoints.activateLeadsTrial(),
    onSuccess: invalidateAll,
  });

  const reactivate = useMutation({
    mutationFn: () => endpoints.reactivateLeadsService(),
    onSuccess: invalidateAll,
  });

  if (status.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textSubtle} />
      </View>
    );
  }
  if (status.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {status.error instanceof Error
            ? status.error.message
            : t("filters", "paywallStatusError")}
        </Text>
      </View>
    );
  }

  const data = status.data;
  if (!data) return null;

  const trialActive = data.state === "TRIAL" && data.isActive;
  const subscriptionActive = data.state === "ACTIVE" && data.isActive;

  // Pokud je vše OK, paywall nemá co zobrazit (caller by neměl vůbec rendrovat)
  if (trialActive || subscriptionActive) return null;

  // Reaktivace: key existuje, isActive=false, ale trial/období ještě běží
  // (admin nebo user dříve vypnul, ale termín nevypršel).
  const now = Date.now();
  const trialStillValid =
    data.state === "TRIAL" &&
    !!data.trialEndsAt &&
    new Date(data.trialEndsAt).getTime() > now;
  const subscriptionStillValid =
    data.state === "ACTIVE" &&
    !!data.paidUntil &&
    new Date(data.paidUntil).getTime() > now;
  const canReactivate =
    data.hasKey && !data.isActive && (trialStillValid || subscriptionStillValid);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>🔒</Text>
      </View>
      <Text style={styles.title}>{t("filters", "paywallTitle")}</Text>

      {data.canActivateTrial ? (
        <>
          <Text style={styles.body}>
            {t("filters", "paywallTrialBody", { days: String(data.trialDays) })}
          </Text>
          {activate.isError && (
            <Text style={styles.errorBox}>
              {activate.error instanceof ApiError
                ? activate.error.message
                : t("filters", "paywallActivateFailed")}
            </Text>
          )}
          <Pressable
            onPress={() => activate.mutate()}
            disabled={activate.isPending}
            style={({ pressed }) => [
              styles.btnPrimary,
              activate.isPending && { opacity: 0.6 },
              pressed && !activate.isPending && { opacity: 0.85 },
            ]}
          >
            {activate.isPending ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {t("filters", "paywallTrialBtn", { days: String(data.trialDays) })}
              </Text>
            )}
          </Pressable>
        </>
      ) : canReactivate ? (
        <>
          <Text style={styles.body}>
            {t("filters", "paywallReactivateBody", {
              date: formatDate(trialStillValid ? data.trialEndsAt! : data.paidUntil!),
            })}
          </Text>
          {reactivate.isError && (
            <Text style={styles.errorBox}>
              {reactivate.error instanceof ApiError
                ? reactivate.error.message
                : t("filters", "paywallReactivateFailed")}
            </Text>
          )}
          <Pressable
            onPress={() => reactivate.mutate()}
            disabled={reactivate.isPending}
            style={({ pressed }) => [
              styles.btnPrimary,
              reactivate.isPending && { opacity: 0.6 },
              pressed && !reactivate.isPending && { opacity: 0.85 },
            ]}
          >
            {reactivate.isPending ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t("filters", "paywallReactivateBtn")}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            {data.state === "TRIAL" && !data.isActive
              ? t("filters", "paywallExpiredTrial")
              : data.state === "SUSPENDED"
                ? t("filters", "paywallSuspended")
                : data.state === "CANCELED"
                  ? t("filters", "paywallCanceled")
                  : t("filters", "paywallNoSubscription")}
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/settings/billing")}
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnPrimaryText}>
              {t("filters", "paywallGoToBillingBtn")}
            </Text>
          </Pressable>
        </>
      )}

      <Text style={styles.fineprint}>{t("filters", "paywallFineprint")}</Text>
    </ScrollView>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      padding: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
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
    title: {
      fontSize: fontSize.xl,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    body: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    errorBox: {
      fontSize: fontSize.sm,
      color: colors.danger,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    btnPrimary: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignSelf: "stretch",
      alignItems: "center",
    },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    fineprint: {
      fontSize: fontSize.xs,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    errorText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
  });
