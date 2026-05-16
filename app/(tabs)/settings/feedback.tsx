import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { endpoints, type FeedbackKind } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const KINDS: FeedbackKind[] = ["BUG", "IMPROVEMENT", "MISSING_TENDER", "OTHER"];
const MAX_ATTACHMENTS = 3;
const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;

interface Attachment {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export default function FeedbackSettingsScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [kind, setKind] = useState<FeedbackKind>("BUG");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function placeholderFor(k: FeedbackKind): string {
    if (k === "BUG") return t("feedback", "placeholderBug");
    if (k === "IMPROVEMENT") return t("feedback", "placeholderImprovement");
    if (k === "MISSING_TENDER") return t("feedback", "placeholderMissingTender");
    return t("feedback", "placeholderOther");
  }

  function kindLabel(k: FeedbackKind): string {
    if (k === "BUG") return t("feedback", "kindBug");
    if (k === "IMPROVEMENT") return t("feedback", "kindImprovement");
    if (k === "MISSING_TENDER") return t("feedback", "kindMissingTender");
    return t("feedback", "kindOther");
  }

  async function addAttachment() {
    setError(null);
    if (attachments.length >= MAX_ATTACHMENTS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENTS - attachments.length,
      quality: 0.8,
      base64: false,
    });
    if (res.canceled) return;
    const next: Attachment[] = [...attachments];
    for (const a of res.assets) {
      if (next.length >= MAX_ATTACHMENTS) break;
      const size = a.fileSize ?? 0;
      if (size > MAX_BYTES_PER_FILE) {
        setError(t("feedback", "attachmentsTooBig"));
        continue;
      }
      next.push({
        uri: a.uri,
        name: a.fileName ?? `image-${Date.now()}.jpg`,
        mimeType: a.mimeType ?? "image/jpeg",
        sizeBytes: size,
      });
    }
    setAttachments(next);
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError(t("feedback", "minLengthError"));
      return;
    }
    setSending(true);
    try {
      await endpoints.submitFeedback({
        kind,
        message: trimmed,
        attachments: attachments.map((a) => ({
          uri: a.uri,
          name: a.name,
          mimeType: a.mimeType,
        })),
      });
      setDone(true);
      setMessage("");
      setAttachments([]);
      setKind("BUG");
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as { code?: string; error?: string } | null;
        if (body?.code === "MONTHLY_CAP_REACHED") {
          setError(t("feedback", "monthlyCapError"));
        } else {
          setError(body?.error ?? t("feedback", "defaultError"));
        }
      } else {
        setError(t("feedback", "networkError"));
      }
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <View style={styles.thanks}>
        <Text style={styles.thanksTitle}>{t("feedback", "thanksTitle")}</Text>
        <Text style={styles.thanksBody}>{t("feedback", "thanksBody")}</Text>
        <Pressable
          onPress={() => setDone(false)}
          style={({ pressed }) => [styles.submitBtn, styles.thanksBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.submitBtnText}>{t("feedback", "thanksAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>{t("feedback", "subtitle")}</Text>

        <Text style={[styles.label, styles.labelMt]}>{t("feedback", "typeLabel")}</Text>
        <View style={styles.kindGrid}>
          {KINDS.map((k) => {
            const active = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={({ pressed }) => [
                  styles.kindChip,
                  active && styles.kindChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[styles.kindChipText, active && styles.kindChipTextActive]}
                >
                  {kindLabel(k)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {kind === "MISSING_TENDER" && (
          <View style={styles.reward}>
            <Text style={styles.rewardText}>{t("feedback", "missingTenderReward")}</Text>
          </View>
        )}

        <Text style={[styles.label, styles.labelMt]}>{t("feedback", "descriptionLabel")}</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={placeholderFor(kind)}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={5000}
          textAlignVertical="top"
          style={styles.textarea}
        />
        <Text style={styles.counter}>
          {t("feedback", "counter", { current: String(message.length) })}
        </Text>

        {attachments.length > 0 && (
          <View style={styles.attachList}>
            {attachments.map((a, idx) => (
              <View key={`${a.uri}-${idx}`} style={styles.attachItem}>
                <Image source={{ uri: a.uri }} style={styles.attachThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.attachSize}>
                    {(a.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeAttachment(idx)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.attachRemove, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.attachRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {attachments.length < MAX_ATTACHMENTS && (
          <Pressable
            onPress={addAttachment}
            style={({ pressed }) => [styles.attachAddBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.attachAddText}>
              {t("feedback", "attachmentsAdd", {
                current: String(attachments.length),
                max: String(MAX_ATTACHMENTS),
              })}
            </Text>
          </Pressable>
        )}

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={sending}
          style={({ pressed }) => [
            styles.submitBtn,
            sending && styles.submitBtnDisabled,
            pressed && !sending && { opacity: 0.85 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.accentForeground} />
          ) : (
            <Text style={styles.submitBtnText}>{t("feedback", "submit")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl, paddingBottom: 100 },
    subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, lineHeight: 20 },
    label: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    labelMt: { marginTop: spacing.lg },
    kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    kindChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    kindChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    kindChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    kindChipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    reward: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rewardText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
    textarea: {
      minHeight: 140,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: colors.text,
    },
    counter: {
      fontSize: fontSize.xs,
      color: colors.textFaint,
      textAlign: "right",
      marginTop: spacing.xs,
    },
    attachList: { marginTop: spacing.md, gap: spacing.sm },
    attachItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    attachThumb: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.bg,
    },
    attachName: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    attachSize: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    attachRemove: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
    },
    attachRemoveText: { fontSize: 22, color: colors.textSubtle, lineHeight: 22 },
    attachAddBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      alignItems: "center",
    },
    attachAddText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    error: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
    },
    errorText: { fontSize: fontSize.sm, color: colors.danger },
    submitBtn: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontSize: fontSize.base, color: colors.accentForeground, fontWeight: "600" },
    thanksBtn: { alignSelf: "stretch" },
    thanks: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    thanksTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
    thanksBody: {
      fontSize: fontSize.base,
      color: colors.textSubtle,
      textAlign: "center",
      marginBottom: spacing.xl,
      lineHeight: 22,
    },
  });
