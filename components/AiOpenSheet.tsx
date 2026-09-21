/**
 * „Otevřít v AI asistentovi" — výběr asistenta a předání zakázky.
 *
 * Tok: server vydá tokenovaný odkaz na balíček zakázky (metadata + profil firmy
 * + odkazy na přílohy) a sestaví prompt; my ho dáme do schránky (pojistka,
 * kdyby prefill z URL nezabral) a otevřeme adresu asistenta s promptem v URL.
 * S nainstalovanou aplikací asistenta ji převezme aplikace (universal link),
 * jinak prohlížeč. Než otevřeme, chvíli počkáme, až worker stáhne přílohy do
 * cache — asistent si o textové verze řekne během pár sekund a bez cache by
 * dostal „stahuje se, zkuste za chvíli".
 */
import { useEffect, useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-deprecated -- core Clipboard je v binárce (OTA-safe); expo-clipboard by chtěl nativní rebuild
import { ActivityIndicator, Alert, Clipboard, Linking, Modal, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { endpoints, type AiProviderView, type AiShareCreateResult } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  tenderId: number;
  onClose: () => void;
}

/** Max čekání na přílohy v cache (worker), pak otevřeme i tak. */
const WAIT_ROUNDS = 20;
const WAIT_MS = 3000;

export default function AiOpenSheet({ visible, tenderId, onClose }: Props) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const settings = useQuery({
    queryKey: ["ai-share-settings"],
    queryFn: async () => (await endpoints.aiShareSettings()).data,
    staleTime: 5 * 60_000,
    enabled: visible,
  });
  const [includeProfile, setIncludeProfile] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // id asistenta / "copy"
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setIncludeProfile(settings.data.prefs.includeProfile);
  }, [settings.data]);

  useEffect(() => {
    if (!visible) { setBusy(null); setStatus(null); }
  }, [visible]);

  async function waitForDocs(res: AiShareCreateResult): Promise<void> {
    let { total, cached } = res.docs;
    // total < 0 = server stav nestihl zjistit (strop 6 s) → zeptáme se hned.
    if (total < 0) {
      const st = await endpoints.aiShareDocsStatus(res.link.id).catch(() => null);
      if (st?.data) { total = st.data.total; cached = st.data.cached; } else total = 0;
    }
    for (let i = 0; i < WAIT_ROUNDS && cached < total; i++) {
      setStatus(t("aiShare", "preparingDocs", { cached, total }));
      await new Promise((r) => setTimeout(r, WAIT_MS));
      const st = await endpoints.aiShareDocsStatus(res.link.id).catch(() => null);
      if (st?.data) { total = st.data.total; cached = st.data.cached; }
    }
  }

  async function run(provider: AiProviderView | null) {
    if (busy) return;
    setBusy(provider?.id ?? "copy");
    setStatus(t("aiShare", "preparing"));
    try {
      const res = (await endpoints.aiShareCreate(tenderId, { provider: provider?.id ?? null, includeProfile, locale })).data;
      Clipboard.setString(res.prompt);
      if (!provider) {
        Alert.alert(t("aiShare", "copied"), t("aiShare", "copiedHint"));
        onClose();
        return;
      }
      await waitForDocs(res);
      setStatus(t("aiShare", "opening", { name: provider.name }));
      const target = res.openUrl ?? res.providerHomeUrl ?? provider.homeUrl;
      if (!res.openUrl) {
        Alert.alert(provider.name, t("aiShare", "noPrefill", { name: provider.name }));
      }
      await Linking.openURL(target);
      onClose();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error)?.message ?? "";
      Alert.alert(t("aiShare", "errorTitle"), msg);
    } finally {
      setBusy(null);
      setStatus(null);
    }
  }

  const providers = settings.data?.providers ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("aiShare", "sheetTitle")}</Text>
          <Text style={styles.hint}>{t("aiShare", "sheetHint")}</Text>

          {settings.isLoading && <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.textSubtle} />}
          {settings.isError && <Text style={styles.error}>{t("aiShare", "loadFailed")}</Text>}

          {providers.map((p) => (
            <Pressable
              key={p.id}
              disabled={!!busy}
              onPress={() => void run(p)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }, busy && busy !== p.id && { opacity: 0.4 }]}
            >
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{p.name}</Text>
                <Text style={styles.rowHint}>{p.hint}</Text>
              </View>
              {busy === p.id ? <ActivityIndicator color={colors.textSubtle} /> : <Text style={styles.chevron}>›</Text>}
            </Pressable>
          ))}

          {providers.length > 0 && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("aiShare", "includeProfile")}</Text>
                <Switch value={includeProfile} onValueChange={setIncludeProfile} disabled={!!busy} />
              </View>
              <Pressable disabled={!!busy} onPress={() => void run(null)} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
                {busy === "copy" ? <ActivityIndicator color={colors.textSubtle} /> : <Text style={styles.copyText}>{t("aiShare", "copyPrompt")}</Text>}
              </Pressable>
            </>
          )}

          {status && <Text style={styles.status}>{status}</Text>}

          <Pressable disabled={!!busy} onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}>
            <Text style={styles.cancelText}>{t("aiShare", "cancel")}</Text>
          </Pressable>
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    card: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl + spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    hint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
    error: { fontSize: fontSize.sm, color: colors.danger, marginVertical: spacing.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dot: { width: 12, height: 12, borderRadius: 6 },
    rowLabel: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    rowHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    chevron: { fontSize: fontSize.lg, color: colors.textFaint },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    switchLabel: { fontSize: fontSize.sm, color: colors.text, flex: 1, marginRight: spacing.md },
    copyBtn: {
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.xs,
    },
    copyText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    status: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
    cancel: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
    cancelText: { fontSize: fontSize.base, color: colors.textSubtle },
  });
