import { useMemo, type ReactNode } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import Constants from "expo-constants";
import { APP_NAME, SUPPORT_WHATSAPP_URL } from "@/lib/config";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Ikonka sekce v zaobleném čtverečku vlevo (monochromaticky dle theme)
  const sectionIcon = (name: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.rowIcon}>
      <Ionicons name={name} size={18} color={colors.textSubtle} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("settings", "title")}</Text>
        <View style={styles.headerPills}>
          <LocaleSwitcher />
          <View style={styles.pillGap} />
          <AppearanceSwitcher />
        </View>
      </View>

      <AppScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={() => router.push("/(tabs)/settings/profile")}
          style={({ pressed }) => [styles.userCard, pressed && styles.rowPressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.userLabel}>{t("settings", "signedInAs")}</Text>
            <Text style={styles.userValue}>
              {user ? user.name || user.email : " "}
            </Text>
            <Text style={styles.userSub}>{user?.name ? user.email : " "}</Text>
          </View>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>

        <View style={styles.group}>
          <SectionRow
            styles={styles}
            icon={sectionIcon("notifications-outline")}
            label={t("settings", "sectionNotifications")}
            hint={t("settings", "sectionNotificationsHint")}
            onPress={() => router.push("/(tabs)/settings/notifications")}
          />
        </View>

        <View style={styles.group}>
          <SectionRow
            styles={styles}
            icon={sectionIcon("shield-checkmark-outline")}
            label={t("settings", "sectionSecurity")}
            hint={t("settings", "sectionSecurityHint")}
            onPress={() => router.push("/(tabs)/settings/security")}
          />
        </View>

        {/* AI nástroje — předpoklady pro analýzu / přípravu dokumentace */}
        <View style={styles.group}>
          <SectionRow
            styles={styles}
            icon={sectionIcon("business-outline")}
            label={t("companyProfile", "menuLabel")}
            hint={t("companyProfile", "menuHint")}
            onPress={() => router.push("/(tabs)/settings/company-profile")}
          />
          <SectionRow
            styles={styles}
            icon={sectionIcon("id-card-outline")}
            label={t("bidIdentity", "menuLabel")}
            hint={t("bidIdentity", "menuHint")}
            onPress={() => router.push("/(tabs)/settings/bid-identity")}
          />
        </View>

        <View style={styles.group}>
          {/* iOS: „Sledované země" — žádná platební terminologie (3.1.1).
              Android: legacy billing s fakturací. */}
          <SectionRow
            styles={styles}
            icon={sectionIcon(Platform.OS === "ios" ? "globe-outline" : "card-outline")}
            label={t("settings", Platform.OS === "ios" ? "sectionCountries" : "sectionBilling")}
            hint={t("settings", Platform.OS === "ios" ? "sectionCountriesHint" : "sectionBillingHint")}
            onPress={() => router.push("/(tabs)/settings/billing")}
          />
        </View>

        <View style={[styles.group, styles.feedbackGroup]}>
          <Pressable
            onPress={() => router.push("/(tabs)/settings/feedback")}
            style={({ pressed }) => [styles.feedbackPress, pressed && styles.rowPressed]}
          >
            {sectionIcon("chatbubble-ellipses-outline")}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t("settings", "sectionFeedback")}</Text>
              <Text style={styles.rowHint}>{t("settings", "sectionFeedbackHint")}</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
            accessibilityLabel={t("settings", "sectionWhatsapp")}
            style={({ pressed }) => [styles.waButton, pressed && styles.rowPressed]}
          >
            <Image source={require("@/assets/whatsapp.png")} style={styles.waIcon} />
          </Pressable>
        </View>

        <View style={styles.group}>
          <SectionRow
            styles={styles}
            icon={sectionIcon("person-outline")}
            label={t("settings", "sectionAccount")}
            hint={t("settings", "sectionAccountHint")}
            onPress={() => router.push("/(tabs)/settings/account")}
          />
        </View>

        <Text style={styles.version}>
          {APP_NAME} v{Constants.expoConfig?.version ?? "?"}
        </Text>
      </AppScrollView>
    </SafeAreaView>
  );
}

function SectionRow({
  styles,
  icon,
  label,
  hint,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  icon?: ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    headerPills: { flexDirection: "row", alignItems: "center" },
    pillGap: { width: spacing.sm },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
    scroll: { padding: spacing.xl, paddingTop: 0 },
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    userLabel: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    userValue: { fontSize: fontSize.base, color: colors.text, fontWeight: "600", marginTop: spacing.sm },
    userSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
    group: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    rowPressed: { backgroundColor: colors.bg },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    feedbackGroup: { flexDirection: "row", alignItems: "stretch" },
    feedbackPress: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    waButton: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    waIcon: { width: 40, height: 40, borderRadius: 10 },
    rowLabel: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    rowHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    rowChevron: { fontSize: 22, color: colors.textFaint, marginLeft: spacing.md },
    version: { textAlign: "center", marginTop: spacing.lg, fontSize: fontSize.xs, color: colors.textFaint },
  });
