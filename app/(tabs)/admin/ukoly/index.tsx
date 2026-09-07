import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type WorkItem, type WorkQueueId, type WorkStatusId } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Fronty práce — jedna fronta na Claude session (viz mrickwood-web `rozdeleni-sessions`).
 * Stejná data i stejné API jako administrace na webu; tady jde hlavně o to,
 * aby šel úkol zadat a posunout z mobilu.
 */
const FRONTY: { id: WorkQueueId; label: string }[] = [
  { id: "EPROTOKOL", label: "eProtokol" },
  { id: "JETCON", label: "JETCON" },
  { id: "VERITRA", label: "Veritra" },
  { id: "LEADS", label: "Leads" },
  { id: "OSTATNI", label: "Ostatní" },
];

const STAVY: WorkStatusId[] = ["NEW", "IN_PROGRESS", "BLOCKED", "DONE", "DROPPED"];

/** Klíč překladu pro stav — mapa místo skládání řetězce, ať to hlídá typ. */
const STAV_KLIC = {
  NEW: "ukolyStatusNEW",
  IN_PROGRESS: "ukolyStatusIN_PROGRESS",
  BLOCKED: "ukolyStatusBLOCKED",
  DONE: "ukolyStatusDONE",
  DROPPED: "ukolyStatusDROPPED",
} as const;
const OTEVRENE = new Set<WorkStatusId>(["NEW", "IN_PROGRESS", "BLOCKED"]);

export default function AdminUkolyScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();

  const [fronta, setFronta] = useState<WorkQueueId | "VSE">("VSE");
  const [uzavrene, setUzavrene] = useState(false);
  const [otevreny, setOtevreny] = useState<string | null>(null);
  const [novy, setNovy] = useState("");
  const [novaFronta, setNovaFronta] = useState<WorkQueueId>("OSTATNI");

  // Rychlé zadání jde do fronty, na kterou se právě koukáš — jinak úkol spadne
  // jinam a z pohledu uživatele se „neobjeví".
  useEffect(() => {
    if (fronta !== "VSE") setNovaFronta(fronta);
  }, [fronta]);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["admin-ukoly", uzavrene],
    queryFn: ({ signal }) => adminApi.listUkoly({ vse: uzavrene }, signal),
  });

  const items: WorkItem[] = query.data?.items ?? [];
  const videt = items.filter(
    (i) => (fronta === "VSE" || i.queue === fronta) && (uzavrene || OTEVRENE.has(i.status)),
  );

  async function uloz(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["admin-ukoly"] });
    } catch {
      Alert.alert(t("admin", "ukolySaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const pocet = (q: WorkQueueId) => items.filter((i) => i.queue === q && OTEVRENE.has(i.status)).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t("admin", "ukolyTitle")}</Text>
          <Pressable onPress={() => setUzavrene((v) => !v)}>
            <Text style={styles.link}>
              {t("admin", uzavrene ? "ukolyHideClosed" : "ukolyShowClosed")}
            </Text>
          </Pressable>
        </View>
        <AppScrollView horizontal contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false}>
          {([{ id: "VSE" as const, label: t("admin", "ukolyAll") }, ...FRONTY]).map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFronta(f.id as WorkQueueId | "VSE")}
              style={[styles.tab, fronta === f.id && styles.tabActive]}
            >
              <Text style={[styles.tabText, fronta === f.id && styles.tabTextActive]}>
                {f.label}
                {f.id !== "VSE" && pocet(f.id as WorkQueueId) > 0 ? ` ${pocet(f.id as WorkQueueId)}` : ""}
              </Text>
            </Pressable>
          ))}
        </AppScrollView>
      </View>

      <AppScrollView contentContainerStyle={styles.list}>
        {/* Rychlé zadání — hlavní důvod, proč tahle obrazovka na mobilu je. */}
        <View style={styles.addBox}>
          <View style={styles.addQueues}>
            {FRONTY.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setNovaFronta(f.id)}
                style={[styles.chip, novaFronta === f.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, novaFronta === f.id && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              value={novy}
              onChangeText={setNovy}
              placeholder={t("admin", "ukolyPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />
            <Pressable
              disabled={busy || !novy.trim()}
              onPress={() => uloz(async () => {
                const ukol = await adminApi.createUkol({ queue: novaFronta, title: novy.trim() });
                setNovy("");
                // Ať je nový úkol vždycky vidět, i když byl zadán z jiné záložky.
                if (fronta !== "VSE" && ukol.queue !== fronta) setFronta(ukol.queue);
              })}
              style={[styles.addBtn, (busy || !novy.trim()) && styles.addBtnOff]}
            >
              <Text style={styles.addBtnText}>{t("admin", "ukolyAdd")}</Text>
            </Pressable>
          </View>
        </View>

        {query.isLoading && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
        {videt.length === 0 && !query.isLoading && (
          <Text style={styles.muted}>{t("admin", "ukolyEmpty")}</Text>
        )}

        {videt.map((it) => {
          const je = otevreny === it.id;
          return (
            <Pressable key={it.id} style={styles.card} onPress={() => setOtevreny(je ? null : it.id)}>
              <View style={styles.cardTop}>
                <Text style={styles.badge}>{t("admin", STAV_KLIC[it.status])}</Text>
                <Text style={styles.queue}>{FRONTY.find((f) => f.id === it.queue)?.label}</Text>
              </View>
              <Text style={styles.subject}>{it.title}</Text>
              {!!it.nextStep && (
                <Text style={styles.next} numberOfLines={je ? undefined : 2}>
                  {t("admin", "ukolyNextStep")}: {it.nextStep}
                </Text>
              )}

              {je && (
                <View style={styles.detail}>
                  {!!it.detail && <Text style={styles.summary}>{it.detail}</Text>}

                  <View style={styles.statusRow}>
                    {STAVY.map((s) => (
                      <Pressable
                        key={s}
                        disabled={busy || it.status === s}
                        onPress={() => uloz(() => adminApi.updateUkol(it.id, { status: s }))}
                        style={[styles.chip, it.status === s && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, it.status === s && styles.chipTextActive]}>
                          {t("admin", STAV_KLIC[s])}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>{t("admin", "ukolyNextStepHint")}</Text>
                  <TextInput
                    defaultValue={it.nextStep ?? ""}
                    multiline
                    placeholderTextColor={colors.textSubtle}
                    style={[styles.input, styles.inputMulti]}
                    onEndEditing={(e) => {
                      const v = e.nativeEvent.text;
                      if (v.trim() !== (it.nextStep ?? "")) {
                        void uloz(() => adminApi.updateUkol(it.id, { nextStep: v }));
                      }
                    }}
                  />

                  <View style={styles.statusRow}>
                    {FRONTY.filter((f) => f.id !== it.queue).map((f) => (
                      <Pressable
                        key={f.id}
                        disabled={busy}
                        onPress={() => uloz(() => adminApi.updateUkol(it.id, { queue: f.id }))}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>→ {f.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    link: { fontSize: fontSize.sm, color: c.textSubtle },
    tabs: { flexDirection: "row", gap: spacing.sm, paddingRight: spacing.lg },
    tab: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.sm, backgroundColor: c.card,
    },
    tabActive: { backgroundColor: c.accent },
    tabText: { fontSize: fontSize.sm, color: c.textSubtle, fontWeight: "600" },
    tabTextActive: { color: c.accentForeground },
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
    spinner: { marginTop: spacing.xl },
    muted: { color: c.textSubtle, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.xl },
    addBox: {
      backgroundColor: c.card, borderRadius: radius.md, padding: spacing.md,
      borderWidth: 1, borderColor: c.border, gap: spacing.sm,
    },
    addQueues: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    addRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    input: {
      flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
      color: c.text, fontSize: fontSize.sm, backgroundColor: c.bg,
    },
    inputMulti: { minHeight: 64, textAlignVertical: "top" },
    addBtn: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.sm, backgroundColor: c.accent,
    },
    addBtnOff: { opacity: 0.4 },
    addBtnText: { color: c.accentForeground, fontWeight: "700", fontSize: fontSize.sm },
    card: {
      backgroundColor: c.card, borderRadius: radius.md, padding: spacing.md,
      borderWidth: 1, borderColor: c.border, gap: spacing.xs,
    },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    badge: {
      fontSize: fontSize.xs, color: c.accent, fontWeight: "700",
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    queue: { fontSize: fontSize.xs, color: c.textSubtle },
    subject: { fontSize: fontSize.base, fontWeight: "600", color: c.text },
    next: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: 19 },
    detail: { gap: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm },
    summary: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: 19 },
    statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    label: { fontSize: fontSize.xs, color: c.textSubtle },
    chip: {
      paddingHorizontal: spacing.sm, paddingVertical: 4,
      borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "600" },
    chipTextActive: { color: c.accentForeground },
  });
