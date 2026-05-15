import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { APP_NAME } from "@/lib/config";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.userCard}>
            <Text style={styles.userLabel}>{t("settings", "signedInAs")}</Text>
            <Text style={styles.userValue}>{user.name || user.email}</Text>
            {user.name && <Text style={styles.userSub}>{user.email}</Text>}
          </View>
        )}

        <View style={styles.group}>
          <SectionRow
            styles={styles}
            label={t("settings", "sectionProfile")}
            hint={t("settings", "sectionProfileHint")}
            onPress={() => router.push("/(tabs)/settings/profile")}
          />
        </View>

        <View style={styles.group}>
          <SectionRow
            styles={styles}
            label={t("settings", "sectionNotifications")}
            hint={t("settings", "sectionNotificationsHint")}
            onPress={() => router.push("/(tabs)/settings/notifications")}
          />
        </View>

        <View style={styles.group}>
          <SectionRow
            styles={styles}
            label={t("settings", "sectionAccount")}
            hint={t("settings", "sectionAccountHint")}
            onPress={() => router.push("/(tabs)/settings/account")}
          />
        </View>

        <Text style={styles.version}>{APP_NAME} v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionRow({
  styles,
  label,
  hint,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
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
    rowLabel: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    rowHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    rowChevron: { fontSize: 22, color: colors.textFaint, marginLeft: spacing.md },
    version: { textAlign: "center", marginTop: spacing.lg, fontSize: fontSize.xs, color: colors.textFaint },
  });
