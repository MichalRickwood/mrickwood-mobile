import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import {
  DIAL_CODES,
  defaultDialCodeForLocale,
  localDigitsRange,
} from "@/lib/dial-codes";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import Picker, { type PickerItem } from "@/components/Picker";

const SAVE_DEBOUNCE_MS = 700;

type SaveState = "idle" | "saving" | "saved";

/**
 * Osobní profil — name, phone, email (readonly). Firemní údaje se editují
 * v sekci Předplatné (BillingProfile.profile).
 */
export default function ProfileScreen() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState(defaultDialCodeForLocale(locale));
  const [phoneLocal, setPhoneLocal] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, billing] = await Promise.all([
          endpoints.profile(),
          endpoints.getBilling().catch(() => null),
        ]);
        if (cancelled) return;
        setName(p.name ?? "");
        if (p.phone) {
          const match = DIAL_CODES.find((d) => p.phone!.startsWith(d.code));
          if (match) {
            setDialCode(match.code);
            setPhoneLocal(p.phone.slice(match.code.length).trim());
          } else {
            setPhoneLocal(p.phone);
          }
        }
        setBillingEmail(billing?.billingProfile.email ?? "");
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

  function scheduleSave(updates: { name?: string | null; phone?: string | null }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(updates), SAVE_DEBOUNCE_MS);
  }

  async function persist(updates: { name?: string | null; phone?: string | null }) {
    setSaveState("saving");
    setError(null);
    try {
      await endpoints.updateProfile(updates);
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (e) {
      setSaveState("idle");
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    }
  }

  function onNameChange(v: string) {
    setName(v);
    scheduleSave({ name: v.trim() || null });
  }

  function onPhoneChange(local: string) {
    const trimmed = local.replace(/[^\d ]/g, "");
    setPhoneLocal(trimmed);
    const cleanDigits = trimmed.replace(/\s+/g, "");
    const phone = cleanDigits ? `${dialCode} ${cleanDigits}` : null;
    scheduleSave({ phone });
  }

  function onDialChange(code: string) {
    setDialCode(code);
    const cleanDigits = phoneLocal.replace(/\s+/g, "");
    const phone = cleanDigits ? `${code} ${cleanDigits}` : null;
    scheduleSave({ phone });
  }

  function onBillingEmailChange(v: string) {
    setBillingEmail(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistBillingEmail(v.trim()), SAVE_DEBOUNCE_MS);
  }

  async function persistBillingEmail(value: string) {
    setSaveState("saving");
    setError(null);
    try {
      await endpoints.updateBilling({ billingProfile: { email: value } });
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (e) {
      setSaveState("idle");
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    }
  }

  const dialItems: PickerItem[] = useMemo(
    () =>
      DIAL_CODES.map((d) => ({
        value: d.code,
        label: `${d.flag} ${d.iso} ${d.code}`,
      })),
    [],
  );

  const phoneRange = localDigitsRange(dialCode);

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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>{t("settings", "accountName")}</Text>
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder={t("register", "namePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />

            <Text style={[styles.label, styles.spacer]}>{t("profileComplete", "phoneLabel")}</Text>
            <View style={styles.phoneRow}>
              <View style={styles.dialBtn}>
                <Picker
                  items={dialItems}
                  value={dialCode}
                  onChange={onDialChange}
                  placeholder={t("profileComplete", "phoneLabel")}
                  searchable
                />
              </View>
              <TextInput
                value={phoneLocal}
                onChangeText={onPhoneChange}
                placeholder={t("profileComplete", "phonePlaceholder")}
                placeholderTextColor={colors.textFaint}
                keyboardType="phone-pad"
                style={[styles.input, styles.phoneInput]}
                maxLength={phoneRange.max + 5}
              />
            </View>

            <Text style={[styles.label, styles.spacer]}>{t("settings", "accountEmail")}</Text>
            <View style={styles.readonlyValue}>
              <Text style={styles.readonlyText}>{user?.email ?? ""}</Text>
            </View>

            <Text style={[styles.label, styles.spacer]}>{t("settings", "profileBillingEmailLabel")}</Text>
            <TextInput
              value={billingEmail}
              onChangeText={onBillingEmailChange}
              placeholder={user?.email ?? ""}
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <Text style={styles.helperText}>{t("settings", "profileBillingEmailHint")}</Text>

            {saveState === "saving" && (
              <Text style={styles.savingHint}>{t("settings", "billingSavingProfile")}</Text>
            )}
            {saveState === "saved" && (
              <Text style={styles.savedHint}>{t("settings", "billingProfileSavedToast")}</Text>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
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
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", marginBottom: spacing.xs },
    spacer: { marginTop: spacing.md },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: colors.text,
    },
    phoneRow: { flexDirection: "row", gap: spacing.sm },
    dialBtn: { minWidth: 80 },
    phoneInput: { flex: 1 },
    readonlyValue: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      opacity: 0.7,
    },
    readonlyText: { fontSize: fontSize.base, color: colors.text },
    savingHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.sm },
    savedHint: { fontSize: fontSize.xs, color: colors.success, marginTop: spacing.sm },
    errorText: { fontSize: fontSize.sm, color: colors.danger, marginTop: spacing.sm },
    helperText: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs, lineHeight: 16 },
  });
