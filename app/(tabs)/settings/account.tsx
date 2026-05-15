import { useMemo, useRef, useState } from "react";
import {
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
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type CancelAction = "DEACTIVATE" | "DELETE";
type FlowMode = "idle" | "confirm-intent" | "code-pending" | "done";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [exporting, setExporting] = useState(false);
  const [exportSentTo, setExportSentTo] = useState<string | null>(null);
  const [mode, setMode] = useState<FlowMode>("idle");
  const [pendingAction, setPendingAction] = useState<CancelAction>("DEACTIVATE");
  const [intentChecked, setIntentChecked] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<TextInput>(null);
  const isDelete = pendingAction === "DELETE";

  function confirmSignOut() {
    Alert.alert(
      t("settings", "signOutConfirmTitle"),
      t("settings", "signOutConfirmBody"),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        { text: t("settings", "confirm"), style: "destructive", onPress: () => void signOut() },
      ],
    );
  }

  async function sendExportEmail() {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setExportSentTo(null);
    try {
      const r = await endpoints.exportAccount();
      setExportSentTo(r.email);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "exportError"));
    } finally {
      setExporting(false);
    }
  }

  function startIntent(action: CancelAction) {
    setPendingAction(action);
    setIntentChecked(false);
    setError(null);
    setMode("confirm-intent");
  }

  async function requestCode() {
    setRequesting(true);
    setError(null);
    try {
      const r = await endpoints.requestAccountCancel(pendingAction);
      setRequestEmail(r.email);
      setCode("");
      setMode("code-pending");
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "cancelErrorGeneric"));
    } finally {
      setRequesting(false);
    }
  }

  async function confirmCode() {
    const cleaned = code.replace(/-/g, "");
    if (cleaned.length !== 8) return;
    setConfirming(true);
    setError(null);
    try {
      await endpoints.confirmAccountCancel({ code: cleaned });
      setMode("done");
      // Server již anonymizoval/deaktivoval. Po krátké pauze odhlásíme klienta.
      setTimeout(() => {
        void signOut();
      }, 3000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "cancelErrorGeneric"));
    } finally {
      setConfirming(false);
    }
  }

  function formatCodeInput(s: string): string {
    const cleaned = s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (cleaned.length <= 4) return cleaned;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {user && (
            <View style={styles.card}>
              <Text style={styles.label}>{t("settings", "accountEmail")}</Text>
              <Text style={styles.value}>{user.email}</Text>
              {user.name && (
                <>
                  <Text style={[styles.label, styles.spacer]}>{t("settings", "accountName")}</Text>
                  <Text style={styles.value}>{user.name}</Text>
                </>
              )}
            </View>
          )}

          <Pressable
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.signOutText}>{t("settings", "signOut")}</Text>
          </Pressable>

          {/* Export */}
          <Section
            styles={styles}
            title={t("settings", "exportTitle")}
            subtitle={t("settings", "exportSubtitle")}
          >
            <Pressable
              onPress={sendExportEmail}
              disabled={exporting || mode !== "idle"}
              style={({ pressed }) => [
                styles.primaryBtn,
                (exporting || mode !== "idle") && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {exporting ? t("settings", "exporting") : t("settings", "exportButton")}
              </Text>
            </Pressable>
            {exportSentTo && (
              <Text style={styles.exportSuccess}>
                {t("settings", "exportSentMessage", { email: exportSentTo })}
              </Text>
            )}
            {error && !exportSentTo && mode === "idle" && (
              <Text style={styles.exportError}>{error}</Text>
            )}
          </Section>

          {/* Deactivate */}
          <Section
            styles={styles}
            title={t("settings", "deactivateTitle")}
            subtitle={t("settings", "deactivateSubtitle")}
          >
            <Pressable
              onPress={() => startIntent("DEACTIVATE")}
              disabled={mode !== "idle"}
              style={({ pressed }) => [
                styles.warnBtn,
                mode !== "idle" && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.warnBtnText}>{t("settings", "deactivateButton")}</Text>
            </Pressable>
            {pendingAction === "DEACTIVATE" && mode !== "idle" && (
              <CancelFlow
                styles={styles}
                colors={colors}
                t={t}
                mode={mode}
                isDelete={false}
                intentChecked={intentChecked}
                setIntentChecked={setIntentChecked}
                requesting={requesting}
                confirming={confirming}
                requestEmail={requestEmail}
                code={code}
                onCodeChange={(s) => setCode(formatCodeInput(s))}
                onRequest={requestCode}
                onConfirm={confirmCode}
                onCancel={() => {
                  setMode("idle");
                  setError(null);
                  setCode("");
                }}
                codeInputRef={codeInputRef}
                error={error}
              />
            )}
          </Section>

          {/* Delete */}
          <Section
            styles={styles}
            title={t("settings", "deleteTitle")}
            subtitle={t("settings", "deleteSubtitle")}
            danger
          >
            <Pressable
              onPress={() => startIntent("DELETE")}
              disabled={mode !== "idle"}
              style={({ pressed }) => [
                styles.dangerBtn,
                mode !== "idle" && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.dangerBtnText}>{t("settings", "deleteButton")}</Text>
            </Pressable>
            {pendingAction === "DELETE" && mode !== "idle" && (
              <CancelFlow
                styles={styles}
                colors={colors}
                t={t}
                mode={mode}
                isDelete={true}
                intentChecked={intentChecked}
                setIntentChecked={setIntentChecked}
                requesting={requesting}
                confirming={confirming}
                requestEmail={requestEmail}
                code={code}
                onCodeChange={(s) => setCode(formatCodeInput(s))}
                onRequest={requestCode}
                onConfirm={confirmCode}
                onCancel={() => {
                  setMode("idle");
                  setError(null);
                  setCode("");
                }}
                codeInputRef={codeInputRef}
                error={error}
              />
            )}
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({
  styles,
  title,
  subtitle,
  children,
  danger,
}: {
  styles: ReturnType<typeof makeStyles>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <View style={[styles.section, danger && styles.sectionDanger]}>
      <Text style={[styles.sectionTitle, danger && styles.sectionTitleDanger]}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

function CancelFlow({
  styles,
  colors,
  t,
  mode,
  isDelete,
  intentChecked,
  setIntentChecked,
  requesting,
  confirming,
  requestEmail,
  code,
  onCodeChange,
  onRequest,
  onConfirm,
  onCancel,
  codeInputRef,
  error,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  t: ReturnType<typeof useI18n>["t"];
  mode: FlowMode;
  isDelete: boolean;
  intentChecked: boolean;
  setIntentChecked: (v: boolean) => void;
  requesting: boolean;
  confirming: boolean;
  requestEmail: string;
  code: string;
  onCodeChange: (s: string) => void;
  onRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  codeInputRef: React.RefObject<TextInput | null>;
  error: string | null;
}) {
  if (mode === "confirm-intent") {
    return (
      <View style={[styles.flowBox, isDelete ? styles.flowBoxDanger : styles.flowBoxWarn]}>
        <Text style={[styles.flowTitle, isDelete ? styles.flowTitleDanger : styles.flowTitleWarn]}>
          {isDelete ? t("settings", "cancelTitleDelete") : t("settings", "cancelTitleDeactivate")}
        </Text>
        <View style={styles.warnList}>
          <WarnItem styles={styles}>{t("settings", "cancelWarnAccessLost")}</WarnItem>
          <WarnItem styles={styles}>{t("settings", "cancelWarnSubRunsToEnd")}</WarnItem>
          <WarnItem styles={styles}>{t("settings", "cancelWarnNoRefund")}</WarnItem>
          {isDelete && <WarnItem styles={styles}>{t("settings", "cancelWarnDataDeleted")}</WarnItem>}
          {isDelete && (
            <WarnItem styles={styles}>{t("settings", "cancelWarnAccountingKept")}</WarnItem>
          )}
          {!isDelete && <WarnItem styles={styles}>{t("settings", "cancelWarnDataKept")}</WarnItem>}
        </View>

        <Pressable
          onPress={() => setIntentChecked(!intentChecked)}
          style={({ pressed }) => [styles.intentRow, pressed && { opacity: 0.7 }]}
        >
          <View
            style={[
              styles.checkbox,
              intentChecked && {
                backgroundColor: isDelete ? colors.danger : colors.warning,
                borderColor: isDelete ? colors.danger : colors.warning,
              },
            ]}
          >
            {intentChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.intentText}>
            {isDelete ? t("settings", "cancelIntentDelete") : t("settings", "cancelIntentDeactivate")}
          </Text>
        </Pressable>

        {error && <Text style={styles.flowError}>{error}</Text>}

        <View style={styles.flowActions}>
          <Pressable onPress={onCancel} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={styles.cancelLink}>{t("settings", "cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={onRequest}
            disabled={!intentChecked || requesting}
            style={({ pressed }) => [
              styles.flowPrimaryBtn,
              isDelete ? styles.flowPrimaryDanger : styles.flowPrimaryWarn,
              (!intentChecked || requesting) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.flowPrimaryText}>
              {requesting ? t("settings", "cancelSending") : t("settings", "cancelSendCode")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (mode === "code-pending") {
    return (
      <View style={[styles.flowBox, styles.flowBoxInfo]}>
        <Text style={styles.flowTitleInfo}>{t("settings", "cancelEmailSent")}</Text>
        <Text style={styles.flowBody}>
          {t("settings", "cancelEmailSentBody", { email: requestEmail })}
        </Text>
        <Text style={styles.codeLabel}>{t("settings", "cancelCodeLabel")}</Text>
        <TextInput
          ref={codeInputRef}
          value={code}
          onChangeText={onCodeChange}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          placeholder={t("settings", "cancelCodePlaceholder")}
          placeholderTextColor={colors.textFaint}
          style={styles.codeInput}
          maxLength={9}
          returnKeyType="done"
          onSubmitEditing={onConfirm}
        />

        {error && <Text style={styles.flowError}>{error}</Text>}

        <Pressable
          onPress={onConfirm}
          disabled={confirming || code.replace(/-/g, "").length !== 8}
          style={({ pressed }) => [
            styles.flowPrimaryBtn,
            isDelete ? styles.flowPrimaryDanger : styles.flowPrimaryWarn,
            styles.flowPrimaryFull,
            (confirming || code.replace(/-/g, "").length !== 8) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.flowPrimaryText}>
            {confirming ? t("settings", "cancelConfirming") : t("settings", "cancelConfirm")}
          </Text>
        </Pressable>

        <View style={styles.flowActions}>
          <Pressable onPress={onCancel} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={styles.cancelLink}>{t("settings", "cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={onRequest}
            disabled={requesting}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLink}>{t("settings", "cancelResend")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (mode === "done") {
    return (
      <View style={[styles.flowBox, styles.flowBoxSuccess]}>
        <Text style={styles.flowTitleSuccess}>
          {isDelete ? t("settings", "cancelDoneDelete") : t("settings", "cancelDoneDeactivate")}
        </Text>
      </View>
    );
  }

  return null;
}

function WarnItem({
  styles,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.warnItem}>
      <Text style={styles.warnBullet}>•</Text>
      <Text style={styles.warnItemText}>{children}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    value: { fontSize: fontSize.base, color: colors.text, fontWeight: "500", marginTop: spacing.xs },
    spacer: { marginTop: spacing.md },
    signOut: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    signOutText: { fontSize: fontSize.base, color: colors.danger, fontWeight: "600" },

    section: {
      marginTop: spacing.xl,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionDanger: { borderColor: colors.danger },
    sectionTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    sectionTitleDanger: { color: colors.danger },
    sectionSubtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.xs,
      lineHeight: 18,
      marginBottom: spacing.md,
    },

    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignSelf: "flex-start",
    },
    primaryBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    exportSuccess: {
      fontSize: fontSize.sm,
      color: colors.success,
      marginTop: spacing.md,
      lineHeight: 18,
    },
    exportError: {
      fontSize: fontSize.sm,
      color: colors.danger,
      marginTop: spacing.md,
      lineHeight: 18,
    },
    warnBtn: {
      backgroundColor: colors.warningBg,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignSelf: "flex-start",
    },
    warnBtnText: { color: colors.warning, fontSize: fontSize.sm, fontWeight: "600" },
    dangerBtn: {
      backgroundColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignSelf: "flex-start",
    },
    dangerBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    btnDisabled: { opacity: 0.4 },
    btnPressed: { opacity: 0.7 },

    flowBox: {
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    flowBoxWarn: { backgroundColor: colors.warningBg, borderColor: colors.warning },
    flowBoxDanger: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
    flowBoxInfo: { backgroundColor: colors.card, borderColor: colors.border },
    flowBoxSuccess: { backgroundColor: colors.successBg, borderColor: colors.success },
    flowTitle: { fontSize: fontSize.base, fontWeight: "600" },
    flowTitleWarn: { color: colors.warning },
    flowTitleDanger: { color: colors.danger },
    flowTitleInfo: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    flowTitleSuccess: {
      color: colors.success,
      fontSize: fontSize.sm,
      fontWeight: "600",
      textAlign: "center",
    },
    flowBody: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.sm,
      lineHeight: 18,
    },
    flowError: {
      fontSize: fontSize.sm,
      color: colors.danger,
      marginTop: spacing.md,
    },
    warnList: { marginTop: spacing.md },
    warnItem: { flexDirection: "row", marginTop: spacing.xs },
    warnBullet: { fontSize: fontSize.sm, color: colors.text, marginRight: spacing.sm },
    warnItemText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
    intentRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
      paddingVertical: spacing.xs,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.borderHover,
      backgroundColor: colors.card,
      marginRight: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    checkmark: { color: colors.accentForeground, fontSize: 14, fontWeight: "700" },
    intentText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
    flowActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.md,
    },
    cancelLink: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    flowPrimaryBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
    },
    flowPrimaryFull: { marginTop: spacing.md, alignItems: "center" },
    flowPrimaryWarn: { backgroundColor: colors.warning },
    flowPrimaryDanger: { backgroundColor: colors.danger },
    flowPrimaryText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },

    codeLabel: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      color: colors.textSubtle,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    codeInput: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.lg,
      color: colors.text,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      letterSpacing: 4,
      textAlign: "center",
    },
  });
