import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { ApiError } from "@/lib/api";
import { endpoints, type NotificationSettings } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import {
  disablePush,
  getPushStatus,
  registerForPushNotifications,
  type PushStatus,
} from "@/lib/notifications";

export default function NotificationsScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPush = useCallback(async () => {
    const s = await getPushStatus();
    setPushStatus(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data] = await Promise.all([endpoints.getNotificationSettings(), refreshPush()]);
        if (!cancelled) setSettings(data.settings);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : t("settings", "loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPush, t]);

  async function patch(key: Exclude<keyof NotificationSettings, "email">, value: boolean) {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, [key]: value });
    setSaving(key);
    setError(null);
    try {
      const r = await endpoints.updateNotificationSettings({ [key]: value });
      setSettings(r.settings);
    } catch (e) {
      setSettings(prev);
      setError(e instanceof ApiError ? e.message : t("settings", "saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  async function togglePush(value: boolean) {
    if (pushBusy) return;
    setPushBusy(true);
    setError(null);
    try {
      if (value) {
        const token = await registerForPushNotifications();
        if (!token) {
          await refreshPush();
        } else {
          setPushStatus({ kind: "active", token });
        }
      } else {
        await disablePush();
        setPushStatus({ kind: "off" });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "saveFailed"));
    } finally {
      setPushBusy(false);
    }
  }

  const pushEnabled = pushStatus?.kind === "active";
  const pushDisabled =
    pushBusy ||
    pushStatus?.kind === "denied" ||
    pushStatus?.kind === "unsupported" ||
    pushStatus?.kind === "need-build";

  if (loading) {
    return (
      <View style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>{t("settings", "pushTitle")}</Text>
        <View style={styles.group}>
          <Row
            styles={styles}
            label={t("settings", "pushLabel")}
            desc={t("settings", "pushDesc")}
            value={pushEnabled}
            disabled={pushDisabled}
            busy={pushBusy}
            onChange={togglePush}
            colors={colors}
          />
          {pushStatus?.kind === "denied" && (
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [styles.note, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.noteText}>{t("settings", "pushPermissionDenied")}</Text>
            </Pressable>
          )}
          {pushStatus?.kind === "unsupported" && (
            <View style={styles.note}>
              <Text style={styles.noteText}>{t("settings", "pushNotSupported")}</Text>
            </View>
          )}
          {pushStatus?.kind === "need-build" && (
            <View style={styles.note}>
              <Text style={styles.noteText}>{t("settings", "pushNeedBuild")}</Text>
            </View>
          )}
        </View>

        {settings && (
          <>
            <Text style={styles.sectionLabel}>{t("settings", "emailTitle")}</Text>
            <View style={styles.group}>
              <Row
                styles={styles}
                label={t("settings", "digestLabel")}
                desc={t("settings", "digestDesc")}
                value={settings.digestEnabled}
                busy={saving === "digestEnabled"}
                onChange={(v) => patch("digestEnabled", v)}
                colors={colors}
              />
              <View style={styles.separator} />
              <Row
                styles={styles}
                label={t("settings", "educationalLabel")}
                desc={t("settings", "educationalDesc")}
                value={settings.educationalEnabled}
                busy={saving === "educationalEnabled"}
                onChange={(v) => patch("educationalEnabled", v)}
                colors={colors}
              />
              <View style={styles.separator} />
              <Row
                styles={styles}
                label={t("settings", "marketingLabel")}
                desc={t("settings", "marketingDesc")}
                value={settings.marketingEnabled}
                busy={saving === "marketingEnabled"}
                onChange={(v) => patch("marketingEnabled", v)}
                colors={colors}
              />
            </View>
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  styles,
  colors,
  label,
  desc,
  value,
  onChange,
  disabled,
  busy,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <View style={styles.rowSwitch}>
        {busy && <ActivityIndicator size="small" color={colors.textSubtle} style={styles.spinner} />}
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled || busy}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.card}
          ios_backgroundColor={colors.border}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    sectionLabel: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
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
    rowText: { flex: 1, paddingRight: spacing.md },
    rowLabel: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    rowDesc: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2, lineHeight: 16 },
    rowSwitch: { flexDirection: "row", alignItems: "center" },
    spinner: { marginRight: spacing.sm },
    separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
    note: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.warningBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    noteText: { fontSize: fontSize.xs, color: colors.warning, lineHeight: 18 },
    errorBox: {
      padding: spacing.md,
      backgroundColor: colors.dangerBg,
      borderRadius: radius.md,
      marginTop: spacing.md,
    },
    errorText: { fontSize: fontSize.sm, color: colors.danger },
  });
