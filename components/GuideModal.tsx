/**
 * Průvodce aplikací — carousel kroků (welcome + funkce), mobilní obdoba
 * webového OnboardingGuideModal. Video návody doplníme později: až budou na
 * Spaces, guideVideoUrl vrátí URL a místo placeholderu se ukáže přehrávač.
 * Odstavec o zkušebním týdnu se ukazuje jen uživatelům v běžícím trialu.
 */
import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { WebView } from "react-native-webview";
import { endpoints } from "@/lib/endpoints";
import { GUIDE_STEPS, guideVideoUrl, type GuideStepId } from "@/lib/guide";
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
  const subsQuery = useQuery({
    queryKey: ["account-subscriptions"],
    queryFn: endpoints.listSubscriptions,
    enabled: visible,
    staleTime: 30_000,
  });
  const trialActive = (subsQuery.data ?? []).some(
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
  const videoUrl = step === "welcome" ? null : guideVideoUrl(step, locale);

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
            <View style={styles.media}>
              <WebView
                source={{ uri: videoUrl }}
                style={{ flex: 1, backgroundColor: "#000" }}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction
              />
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
              <Ionicons name="gift-outline" size={18} color="#047857" style={styles.trialIcon} />
              <Text style={styles.trialText}>{t("guide", "trialNote")}</Text>
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
      paddingVertical: spacing.xl * 2,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    heroLogo: { width: 220, height: 35 },
    heroTagline: { marginTop: spacing.md, fontSize: fontSize.sm, color: "#78716C" },
    media: {
      aspectRatio: 16 / 10,
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
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: spacing.lg,
      backgroundColor: "#ECFDF5",
      borderColor: "#A7F3D0",
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    trialIcon: { marginRight: spacing.sm, marginTop: 1 },
    trialText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20, color: "#065F46" },
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
