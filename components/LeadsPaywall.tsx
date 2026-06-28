import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { endpoints } from "@/lib/endpoints";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { isIapAvailable } from "@/lib/iap";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Paywall pro LEADS službu — zobrazí se v Zakázkách tabu když /api/v2/leads/matches
 * vrátí 402. Loaduje status služby; pokud user nikdy neměl trial → tlačítko
 * aktivace, jinak → CTA do nastavení předplatného (karta/fa flow).
 */
export default function LeadsPaywall() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["service", "leads"],
    queryFn: () => endpoints.getLeadsService(),
  });

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["service", "leads"] }),
      // i subscriptions — tabs/index gating (leadsInactive) z nich čte; bez toho
      // by paywall po obnovení nezmizel.
      qc.invalidateQueries({ queryKey: ["account-subscriptions"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["filters"] }),
    ]);
  }

  // Uživatel bez trialu (canActivateTrial) = neprošel onboardingem → pošli ho na
  // profil (NE aktivovat CZ trial napřímo z paywallu — to obchází výběr zemí +
  // fakturační údaje). Paywall je jen pro post-trial (suspended/canceled/expired).
  const canActivate = !!status.data?.canActivateTrial;
  useEffect(() => {
    if (canActivate) router.replace("/(onboarding)/profile");
  }, [canActivate, router]);

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

  // Subscription.state zůstává "TRIAL" i po expiraci — entitlement check
  // server-side vrátí 402, ale klient musí trial-vypršel detekovat sám
  // (jinak by paywall vrátil null a zobrazila se bílá stránka).
  const trialExpired =
    data.state === "TRIAL" &&
    !!data.trialEndsAt &&
    new Date(data.trialEndsAt).getTime() < Date.now();
  const trialActive = data.state === "TRIAL" && !trialExpired;
  const subscriptionActive = data.state === "ACTIVE";

  // Pokud je vše OK, paywall nemá co zobrazit (caller by neměl vůbec rendrovat)
  if (trialActive || subscriptionActive) return null;

  // canActivateTrial → probíhá redirect na onboarding (viz useEffect), mezitím spinner.
  if (data.canActivateTrial) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textSubtle} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={status.isFetching}
          onRefresh={() => {
            void status.refetch();
            void qc.invalidateQueries({ queryKey: ["matches"] });
          }}
          tintColor={colors.textSubtle}
        />
      }
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>🔒</Text>
      </View>
      <Text style={styles.title}>{t("filters", "paywallInactiveTitle")}</Text>
      <Text style={styles.body}>
        {trialExpired
          ? t("filters", "paywallExpiredTrial")
          : data.state === "CANCELED"
            ? t("filters", "paywallCanceled")
            : t("filters", "paywallSuspended")}
      </Text>
      {/* iOS: Apple IAP — CTA do Nastavení → Sledované země, kde se předplácí
          per země přes StoreKit. (Android/web platí mimo appku, viz 3.1.1.) */}
      {isIapAvailable() && (
        <Pressable
          onPress={() => router.push("/(tabs)/settings/billing")}
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnPrimaryText}>{t("onboardingCountries", "subscribe")}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => void invalidateAll()}
        disabled={status.isFetching}
        style={({ pressed }) => [styles.recheckBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.recheckText}>{t("filters", "paywallRecheckBtn")}</Text>
      </Pressable>
    </ScrollView>
  );
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
    recheckBtn: { paddingVertical: spacing.md, alignItems: "center", alignSelf: "stretch" },
    recheckText: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
    fineprint: {
      fontSize: fontSize.xs,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    errorText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
  });
