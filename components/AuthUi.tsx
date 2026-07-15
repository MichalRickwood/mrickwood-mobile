/**
 * Sdílené UI pro auth obrazovky (email-login, register, forgot-password):
 *  - AuthHeader: šipka zpět vlevo nahoře (router.back s fallbackem na landing)
 *  - AuthBrand: malý Veritra mark + titulek + podtitulek
 *  - AuthTextField: pole s ikonou vlevo, accent borderem při fokusu, volitelným
 *    okem (secure toggle) a trvalým hintem pod polem; podporuje iOS autofill
 *    (textContentType/autoComplete předává dál).
 *  - AuthError: chybový box s ikonou.
 */
import { forwardRef, useMemo, useState, type ComponentProps } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export function AuthHeader() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        hitSlop={10}
        accessibilityLabel={t("guide", "back")}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

export function AuthBrand({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.brandWrap}>
      <Image
        source={
          isDark
            ? require("@/assets/veritra-mark-light.png")
            : require("@/assets/veritra-mark.png")
        }
        style={styles.brandMark}
        resizeMode="contain"
      />
      <Text style={styles.brandTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.brandSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function AuthError({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginTop: 1 }} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

type FieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Trvalý hint pod polem (nezmizí při psaní jako placeholder). */
  hint?: string;
  /** Heslové pole s okem pro zobrazení/skrytí. */
  secure?: boolean;
} & Omit<ComponentProps<typeof TextInput>, "style">;

export const AuthTextField = forwardRef<TextInput, FieldProps>(function AuthTextField(
  { label, icon, hint, secure = false, ...inputProps },
  ref,
) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Ionicons name={icon} size={18} color={focused ? colors.text : colors.textFaint} />
        <TextInput
          ref={ref}
          {...inputProps}
          secureTextEntry={secure ? hidden : false}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityLabel={t("auth", hidden ? "showPassword" : "hidePassword")}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.textFaint}
            />
          </Pressable>
        )}
      </View>
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
});

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    brandWrap: { alignItems: "flex-start", marginBottom: spacing.xl },
    brandMark: { width: 44, height: 36, marginBottom: spacing.lg },
    brandTitle: {
      fontSize: fontSize.xxl,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.5,
    },
    brandSubtitle: { fontSize: fontSize.base, color: colors.textSubtle, marginTop: spacing.xs },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: colors.dangerBg,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, lineHeight: 19 },
    fieldWrap: { marginTop: spacing.md },
    fieldLabel: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textSubtle,
      marginBottom: spacing.xs,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.cardElevated,
      paddingHorizontal: spacing.md,
    },
    inputRowFocused: { borderColor: colors.text },
    input: {
      flex: 1,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: colors.text,
    },
    fieldHint: { fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.xs },
  });
