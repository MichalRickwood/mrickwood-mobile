import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { saveToken } from "@/lib/auth-storage";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function SecurityScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [revoking, setRevoking] = useState(false);

  function confirmRevokeAll() {
    Alert.alert(
      t("settings", "revokeAllConfirmTitle"),
      t("settings", "revokeAllConfirmBody"),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        {
          text: t("settings", "revokeAllBtn"),
          style: "destructive",
          onPress: () => void doRevokeAll(),
        },
      ],
    );
  }

  async function doRevokeAll() {
    if (revoking) return;
    setRevoking(true);
    setError(null);
    // Pošli revoke server-side, ale i kdyby selhal (síť, deploy lag), pořád
    // lokálně odhlas — pak je to aspoň ekvivalent regulárního Sign Out.
    let apiOk = true;
    try {
      await endpoints.revokeAllSessions();
    } catch (e) {
      apiOk = false;
      console.warn("[revokeAllSessions] API failed:", (e as Error).message);
    }
    try {
      await signOut();
    } catch (e) {
      console.warn("[signOut] failed:", (e as Error).message);
    }
    if (!apiOk) {
      // signOut už nastavil status=anonymous → screen se unmountne, error se
      // stejně neukáže. Loguj jen pro dev.
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await endpoints.getPasswordStatus();
        if (!cancelled) setHasPassword(r.hasPassword);
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

  async function onSubmit() {
    if (saving) return;
    setError(null);
    setSaved(false);
    if (next.length < 8) {
      setError(t("settings", "passwordMinLengthError"));
      return;
    }
    if (next !== next2) {
      setError(t("settings", "passwordMismatchError"));
      return;
    }
    setSaving(true);
    try {
      const r = await endpoints.changePassword({
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      });
      // Server inkrementoval mobileTokenVersion → starý JWT už neplatí.
      // Uložíme nový vrácený token, jinak by další volání skončilo 401 a
      // klient by se odhlásil.
      await saveToken(r.token);
      setCurrent("");
      setNext("");
      setNext2("");
      setHasPassword(true);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || hasPassword === null) {
    return (
      <View style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      </View>
    );
  }

  const submitDisabled = saving || !next || !next2 || (hasPassword && !current);

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {hasPassword ? t("settings", "passwordTitleChange") : t("settings", "passwordTitleSet")}
          </Text>
          {!hasPassword && (
            <Text style={styles.subtitle}>{t("settings", "passwordSubtitleSet")}</Text>
          )}

          <View style={styles.form}>
            {hasPassword && (
              <>
                <Text style={styles.label}>{t("settings", "currentPasswordLabel")}</Text>
                <TextInput
                  value={current}
                  onChangeText={setCurrent}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  returnKeyType="next"
                />
              </>
            )}

            <Text style={[styles.label, hasPassword && styles.mt]}>
              {t("settings", "newPasswordLabel")}
            </Text>
            <TextInput
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.mt]}>
              {t("settings", "newPasswordAgainLabel")}
            </Text>
            <TextInput
              value={next2}
              onChangeText={setNext2}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />

            {error && <Text style={styles.error}>{error}</Text>}
            {saved && <Text style={styles.success}>{t("settings", "passwordSavedToast")}</Text>}

            <Pressable
              onPress={onSubmit}
              disabled={submitDisabled}
              style={({ pressed }) => [
                styles.button,
                submitDisabled && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                {saving ? t("settings", "passwordSubmitting") : t("settings", "passwordSubmit")}
              </Text>
            </Pressable>
          </View>

          <View style={styles.revokeBox}>
            <Text style={styles.revokeTitle}>{t("settings", "revokeAllTitle")}</Text>
            <Text style={styles.revokeSubtitle}>{t("settings", "revokeAllSubtitle")}</Text>
            <Pressable
              onPress={confirmRevokeAll}
              disabled={revoking}
              style={({ pressed }) => [
                styles.revokeBtn,
                revoking && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.revokeBtnText}>{t("settings", "revokeAllBtn")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
    subtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    form: { marginTop: spacing.xl },
    label: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.sm,
    },
    mt: { marginTop: spacing.lg },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: colors.text,
    },
    error: {
      color: colors.danger,
      fontSize: fontSize.sm,
      marginTop: spacing.lg,
      backgroundColor: colors.dangerBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    success: {
      color: colors.success,
      fontSize: fontSize.sm,
      marginTop: spacing.lg,
      backgroundColor: colors.successBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    button: {
      marginTop: spacing.xl,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    buttonDisabled: { opacity: 0.4 },
    buttonPressed: { backgroundColor: colors.accentHover },
    buttonText: {
      color: colors.accentForeground,
      fontSize: fontSize.base,
      fontWeight: "600",
    },
    revokeBox: {
      marginTop: spacing.xxl,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: spacing.lg,
    },
    revokeTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.danger },
    revokeSubtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    revokeBtn: {
      backgroundColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignSelf: "flex-start",
    },
    revokeBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
  });
