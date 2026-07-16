/**
 * Průvodce aplikací — carousel kroků (welcome + funkce), mobilní obdoba
 * webového OnboardingGuideModal. Video návody doplníme později: až budou na
 * Spaces, guideVideoUrl vrátí URL a místo placeholderu se ukáže přehrávač.
 * Odstavec o zkušebním týdnu se ukazuje jen uživatelům v běžícím trialu.
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { WebView } from "react-native-webview";
import { endpoints } from "@/lib/endpoints";
import { useAuth } from "@/lib/auth-context";
import {
  GUIDE_STEPS,
  cachedGuideVideoUri,
  guideVideoUrl,
  type GuideStepId,
} from "@/lib/guide";
import { useI18n } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/translations";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const STEP_ICON: Record<Exclude<GuideStepId, "welcome">, keyof typeof Ionicons.glyphMap> = {
  orientation: "list-outline",
  emailDigest: "mail-outline",
  aiAnalysis: "sparkles-outline",
  subscription: "business-outline",
};

type GuideKey = keyof Dict["guide"];

export default function GuideModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);

  // Reset na první krok při každém otevření.
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  // Trial box jen pro běžící trial — platícím (ruční otevření z Nastavení)
  // by „týden zdarma" působil nepatřičně. Best-effort: bez dat se box neukáže.
  // Admin ho vidí vždy (kontrola obsahu průvodce bez nutnosti trial účtu).
  const isAdmin = useAuth().user?.role === "ADMIN";
  const subsQuery = useQuery({
    queryKey: ["account-subscriptions"],
    queryFn: endpoints.listSubscriptions,
    enabled: visible && !isAdmin,
    staleTime: 30_000,
  });
  const trialActive =
    isAdmin ||
    (subsQuery.data ?? []).some(
      (s) =>
        s.service === "LEADS" &&
        s.state === "TRIAL" &&
        !!s.trialEndsAt &&
        new Date(s.trialEndsAt).getTime() > Date.now(),
    );

  const step = GUIDE_STEPS[Math.min(index, GUIDE_STEPS.length - 1)];
  const isLast = index >= GUIDE_STEPS.length - 1;
  const titleKey = (step === "welcome" ? "welcomeTitle" : `${step}Title`) as GuideKey;
  const bodyKey = (step === "welcome" ? "welcomeBody" : `${step}Body`) as GuideKey;

  // Videa se při otevření průvodce předstáhnou do cache (0,3–1,5 MB/kus) a
  // hrají se z disku — streamování ze Spaces ve WebView startovalo pomalu.
  // DOČASNĚ admin-only preview (schvalovací kolo) — po odsouhlasení gate odstranit.
  const [videoUris, setVideoUris] = useState<Partial<Record<GuideStepId, string>>>({});
  useEffect(() => {
    if (!visible || !isAdmin) return;
    let cancelled = false;
    (async () => {
      for (const s of GUIDE_STEPS) {
        if (s === "welcome" || !guideVideoUrl(s, locale)) continue;
        const uri = await cachedGuideVideoUri(s, locale);
        if (cancelled) return;
        if (uri) setVideoUris((prev) => (prev[s] === uri ? prev : { ...prev, [s]: uri }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, isAdmin, locale]);

  const remoteVideoUrl = step === "welcome" || !isAdmin ? null : guideVideoUrl(step, locale);
  const videoUrl = remoteVideoUrl ? (videoUris[step] ?? null) : null;
  const videoLoading = !!remoteVideoUrl && !videoUrl;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerKicker}>{t("guide", "title")}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t("guide", "skip")}>
            <Ionicons name="close" size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
          <Text style={styles.stepTitle}>{t("guide", titleKey)}</Text>

          {step === "welcome" ? (
            <View style={styles.hero}>
              <Image
                source={require("@/assets/veritra-logo-text.png")}
                style={styles.heroLogo}
                resizeMode="contain"
              />
              <Text style={styles.heroTagline}>{t("brand", "tagline")}</Text>
            </View>
          ) : videoUrl ? (
            <View style={styles.mediaPortrait}>
              <WebView
                source={{ uri: videoUrl }}
                style={{ flex: 1, backgroundColor: "#000" }}
                originWhitelist={["*"]}
                allowFileAccess
                allowFileAccessFromFileURLs
                allowingReadAccessToURL={videoUrl}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction
              />
            </View>
          ) : videoLoading ? (
            <View style={[styles.mediaPortrait, styles.mediaPlaceholder]}>
              <ActivityIndicator color={colors.textSubtle} />
            </View>
          ) : (
            <View style={[styles.media, styles.mediaPlaceholder]}>
              <Ionicons
                name={STEP_ICON[step as Exclude<GuideStepId, "welcome">]}
                size={40}
                color={colors.textSubtle}
              />
              <Text style={styles.mediaSoon}>{t("guide", "videoSoon")}</Text>
            </View>
          )}

          <Text style={styles.body}>{t("guide", bodyKey)}</Text>

          {step === "welcome" && trialActive && (
            <View style={styles.trialBox}>
              <View style={styles.trialTitleRow}>
                <Ionicons name="gift-outline" size={18} color="#047857" />
                <Text style={styles.trialTitle}>{t("guide", "trialTitle")}</Text>
              </View>
              <Text style={styles.trialText}>{t("guide", "trialBody")}</Text>
            </View>
          )}

          {/* Agenda kroků — vyplní welcome stránku a zároveň slouží jako
              rychlá navigace (tap = skok na krok). */}
          {step === "welcome" && (
            <View style={styles.agenda}>
              <Text style={styles.agendaTitle}>{t("guide", "agendaTitle")}</Text>
              <View style={styles.agendaCard}>
                {GUIDE_STEPS.filter((s) => s !== "welcome").map((s, i) => (
                  <Pressable
                    key={s}
                    onPress={() => setIndex(GUIDE_STEPS.indexOf(s))}
                    style={({ pressed }) => [
                      styles.agendaRow,
                      i > 0 && styles.agendaRowBorder,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <View style={styles.agendaIcon}>
                      <Ionicons
                        name={STEP_ICON[s as Exclude<GuideStepId, "welcome">]}
                        size={17}
                        color={colors.textSubtle}
                      />
                    </View>
                    <Text style={styles.agendaText}>
                      {t("guide", `${s}Title` as GuideKey)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {GUIDE_STEPS.map((s, i) => (
              <Pressable key={s} onPress={() => setIndex(i)} hitSlop={8}>
                <View style={[styles.dot, i === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.footerBtns}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.skipBtn}>
              <Text style={styles.skipText}>{t("guide", "skip")}</Text>
            </Pressable>
            {index > 0 && (
              <Pressable
                onPress={() => setIndex((i) => Math.max(i - 1, 0))}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.backText}>{t("guide", "back")}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => (isLast ? onClose() : setIndex((i) => i + 1))}
              style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.nextText}>{isLast ? t("guide", "done") : t("guide", "next")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    headerKicker: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textSubtle,
    },
    scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    stepTitle: {
      fontSize: fontSize.xl,
      fontWeight: "700",
      color: colors.text,
      marginBottom: spacing.lg,
      letterSpacing: -0.3,
    },
    // Brand hero — krémové pozadí dle boot screenu, logo je tmavý lockup.
    hero: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F4F0E4",
      borderRadius: radius.lg,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    heroLogo: { width: 175, height: 28 },
    heroTagline: { marginTop: spacing.sm, fontSize: fontSize.xs, color: "#78716C" },
    media: {
      aspectRatio: 16 / 10,
      borderRadius: radius.lg,
      overflow: "hidden",
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // Portrétní video (810×1800) — telefon 1:1, čitelný obsah; užší box na střed.
    mediaPortrait: {
      alignSelf: "center",
      width: "62%",
      aspectRatio: 810 / 1800,
      borderRadius: radius.lg,
      overflow: "hidden",
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mediaPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.card,
    },
    mediaSoon: { fontSize: fontSize.xs, color: colors.textSubtle },
    body: { fontSize: fontSize.base, lineHeight: 22, color: colors.text },
    trialBox: {
      marginTop: spacing.lg,
      backgroundColor: "#ECFDF5",
      borderColor: "#A7F3D0",
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    trialTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    trialTitle: { fontSize: fontSize.base, fontWeight: "700", color: "#047857" },
    trialText: { fontSize: fontSize.sm, lineHeight: 19, color: "#065F46", marginTop: spacing.xs },
    agenda: { marginTop: spacing.lg },
    agendaTitle: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.textSubtle,
      marginBottom: spacing.sm,
    },
    agendaCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
    },
    agendaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    agendaRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    agendaIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    agendaText: { flex: 1, fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: { width: 20, backgroundColor: colors.text },
    footerBtns: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    skipBtn: { paddingVertical: spacing.sm, paddingRight: spacing.md, marginRight: "auto" },
    skipText: { fontSize: fontSize.base, color: colors.textSubtle },
    backBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backText: { fontSize: fontSize.base, color: colors.text },
    nextBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      backgroundColor: colors.text,
    },
    nextText: { fontSize: fontSize.base, fontWeight: "600", color: colors.bg },
  });
