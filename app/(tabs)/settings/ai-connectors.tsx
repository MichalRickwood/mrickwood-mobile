/**
 * Nastavení → AI asistenti: výchozí asistent, profil do balíčku, vlastní zadání,
 * adresa MCP konektoru pro Claude/ChatGPT a přehled vydaných odkazů (zneplatnění).
 */
import { useEffect, useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-deprecated -- core Clipboard je v binárce (OTA-safe); expo-clipboard by chtěl nativní rebuild
import { ActivityIndicator, Alert, Clipboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import { endpoints, type AiShareLinkView, type AiSharePrefs } from "@/lib/endpoints";
import { API_BASE_URL } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const MCP_URL = `${API_BASE_URL.replace(/\/$/, "")}/api/mcp`;

export default function AiConnectorsScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ai-share-settings"],
    queryFn: async () => (await endpoints.aiShareSettings()).data,
  });
  const [prefs, setPrefs] = useState<AiSharePrefs | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data && !prefs) setPrefs(q.data.prefs); }, [q.data, prefs]);

  const save = useMutation({
    mutationFn: (patch: Partial<AiSharePrefs>) => endpoints.aiSharePrefsSave(patch),
    onSuccess: (res) => {
      setPrefs(res.data.prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      void qc.invalidateQueries({ queryKey: ["ai-share-settings"] });
    },
    onError: (e) => Alert.alert(t("aiShare", "errorTitle"), (e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => endpoints.aiShareRevoke(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ai-share-settings"] }),
    onError: (e) => Alert.alert(t("aiShare", "errorTitle"), (e as Error).message),
  });

  function confirmRevoke(link: AiShareLinkView) {
    Alert.alert(t("aiShare", "revoke"), t("aiShare", "revokeConfirm"), [
      { text: t("aiShare", "cancel"), style: "cancel" },
      { text: t("aiShare", "revoke"), style: "destructive", onPress: () => revoke.mutate(link.id) },
    ]);
  }

  function linkState(l: AiShareLinkView): string {
    if (l.revokedAt) return t("aiShare", "linkRevoked");
    if (!l.active) return t("aiShare", "linkExpired");
    return t("aiShare", "linkActive", { date: new Date(l.expiresAt).toLocaleDateString(locale) });
  }

  if (q.isLoading || !prefs) {
    return <View style={styles.center}>{q.isError ? <Text style={styles.error}>{t("aiShare", "loadFailed")}</Text> : <ActivityIndicator color={colors.textSubtle} />}</View>;
  }
  const providers = q.data?.providers ?? [];
  const links = q.data?.links ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <AppScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Výchozí asistent */}
        <Text style={styles.sectionLabel}>{t("aiShare", "defaultProvider")}</Text>
        <View style={styles.chips}>
          <Chip label={t("aiShare", "askEveryTime")} active={!prefs.provider} onPress={() => save.mutate({ provider: null })} styles={styles} />
          {providers.map((p) => (
            <Chip key={p.id} label={p.name} color={p.color} active={prefs.provider === p.id} onPress={() => save.mutate({ provider: p.id })} styles={styles} />
          ))}
        </View>
        <Text style={styles.hint}>{t("aiShare", "defaultProviderHint")}</Text>

        {/* Profil firmy */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("aiShare", "includeProfile")}</Text>
          <Switch value={prefs.includeProfile} onValueChange={(v) => save.mutate({ includeProfile: v })} />
        </View>
        <Text style={styles.hint}>{t("aiShare", "includeProfileHint")}</Text>

        {/* Vlastní zadání */}
        <Text style={styles.sectionLabel}>{t("aiShare", "promptTitle")}</Text>
        <TextInput
          style={styles.input}
          multiline
          value={prefs.promptTemplate ?? ""}
          onChangeText={(v) => setPrefs({ ...prefs, promptTemplate: v })}
          placeholder={t("aiShare", "promptPlaceholder")}
          placeholderTextColor={colors.textFaint}
        />
        <Text style={styles.hint}>{t("aiShare", "promptHint")}</Text>
        <Pressable
          disabled={save.isPending}
          onPress={() => save.mutate({ promptTemplate: prefs.promptTemplate?.trim() || null })}
          style={({ pressed }) => [styles.primaryBtn, (pressed || save.isPending) && { opacity: 0.7 }]}
        >
          {save.isPending ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.primaryText}>{saved ? t("aiShare", "saved") : t("aiShare", "save")}</Text>}
        </Pressable>

        {/* MCP konektor */}
        <Text style={styles.sectionLabel}>{t("aiShare", "mcpTitle")}</Text>
        <Text style={styles.hint}>{t("aiShare", "mcpHint")}</Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlText} selectable>{MCP_URL}</Text>
          <Pressable
            onPress={() => { Clipboard.setString(MCP_URL); Alert.alert(t("aiShare", "copied")); }}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryText}>{t("aiShare", "mcpCopy")}</Text>
          </Pressable>
        </View>

        {/* Vydané odkazy */}
        <Text style={styles.sectionLabel}>{t("aiShare", "linksTitle")}</Text>
        <Text style={styles.hint}>{t("aiShare", "linksHint")}</Text>
        {links.length === 0 && <Text style={styles.empty}>{t("aiShare", "linksEmpty")}</Text>}
        {links.map((l) => (
          <View key={l.id} style={styles.linkRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle} numberOfLines={2}>{l.tenderTitle}</Text>
              <Text style={styles.linkMeta}>
                {[l.providerName, linkState(l), t("aiShare", "linkOpens", { count: l.accessCount })].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {l.active && (
              <Pressable onPress={() => confirmRevoke(l)} style={({ pressed }) => [styles.revokeBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.revokeText}>{t("aiShare", "revoke")}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </AppScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, color, active, onPress, styles }: { label: string; color?: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}>
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 110, gap: spacing.sm },
    sectionLabel: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg },
    hint: { fontSize: fontSize.sm, color: colors.textMuted },
    error: { fontSize: fontSize.sm, color: colors.danger },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { fontSize: fontSize.sm, color: colors.text },
    chipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
    switchLabel: { fontSize: fontSize.base, color: colors.text, flex: 1, marginRight: spacing.md },
    input: { minHeight: 120, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.text, backgroundColor: colors.card, fontSize: fontSize.sm },
    primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    primaryText: { color: colors.accentForeground, fontWeight: "600", fontSize: fontSize.base },
    urlBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card, gap: spacing.sm },
    urlText: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: fontSize.sm, color: colors.text },
    secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    secondaryText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    empty: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.sm },
    linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    linkTitle: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    linkMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    revokeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.dangerBg },
    revokeText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: "600" },
  });
