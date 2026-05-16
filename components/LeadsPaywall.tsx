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
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Paywall pro LEADS službu — zobrazí se v Zakázkách tabu když /api/mobile/matches
 * vrátí 402. Loaduje status služby; pokud user nikdy neměl trial → tlačítko
 * aktivace, jinak → CTA do nastavení předplatného (karta/fa flow).
 */
export default function LeadsPaywall() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["service", "leads"],
    queryFn: () => endpoints.getLeadsService(),
  });

  const activate = useMutation({
    mutationFn: () => endpoints.activateLeadsTrial(),
    onSuccess: async () => {
      // Invalidate vše co může být blokované 402 — matches, filters, status
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["service", "leads"] }),
        qc.invalidateQueries({ queryKey: ["matches"] }),
        qc.invalidateQueries({ queryKey: ["filters"] }),
      ]);
    },
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
            : "Nepodařilo se načíst stav služby."}
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

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>🔒</Text>
      </View>
      <Text style={styles.title}>Aktivuj službu Veřejné zakázky</Text>

      {data.canActivateTrial ? (
        <>
          <Text style={styles.body}>
            Spusť si {data.trialDays}denní zkušební období zdarma. Plný přístup
            ke všem zakázkám, filtrům a notifikacím.
          </Text>
          {activate.isError && (
            <Text style={styles.errorBox}>
              {activate.error instanceof ApiError
                ? activate.error.message
                : "Aktivace selhala."}
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
                Aktivovat {data.trialDays}denní trial zdarma
              </Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            {data.state === "TRIAL" && !data.isActive
              ? "Tvůj trial skončil. Aktivuj plné předplatné a pokračuj v práci se zakázkami."
              : data.state === "SUSPENDED"
                ? "Tvé předplatné je pozastaveno. Obnov platbu pro plný přístup."
                : data.state === "CANCELED"
                  ? "Předplatné bylo zrušeno. Aktivuj znovu pro přístup."
                  : "Pro plný přístup je potřeba aktivovat předplatné."}
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/settings/billing")}
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnPrimaryText}>Přejít na předplatné</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.fineprint}>
        Kdykoli můžeš spravovat předplatné v Nastavení → Předplatné.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
