/**
 * Firemní profily (multi-profil na účet) — seznam + správa (přidat do limitu,
 * přejmenovat, smazat, nastavit výchozí). Z každého profilu se jde na jeho
 * AI profil (company-profile?profileId=) a bid identitu (bid-identity?profileId=).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { endpoints, type ProfileSummary } from "@/lib/endpoints";

export default function CompanyProfilesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [maxProfiles, setMaxProfiles] = useState(5);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIco, setNewIco] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await endpoints.companyProfilesList();
      setProfiles(r.data.profiles);
      setMaxProfiles(r.data.maxProfiles ?? 5);
    } catch {
      // ponech předchozí stav
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      await endpoints.companyProfileCreate({ label: newLabel.trim() || undefined, ico: newIco.trim() || undefined });
      setAdding(false);
      setNewLabel("");
      setNewIco("");
      await load();
    } catch (e) {
      Alert.alert(t("companyProfiles", "limitError"), e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(p: ProfileSummary) {
    if (busy || p.isDefault) return;
    setBusy(true);
    try {
      await endpoints.companyProfileUpdate(p.id, { isDefault: true });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function rename(p: ProfileSummary) {
    // Alert.prompt je jen iOS; na Androidu jednoduchý fallback přes okno přidání.
    if (Platform.OS === "ios") {
      Alert.prompt(t("companyProfiles", "renameTitle"), undefined, async (value) => {
        if (!value?.trim()) return;
        await endpoints.companyProfileUpdate(p.id, { label: value.trim() });
        await load();
      }, "plain-text", p.label);
    } else {
      setAdding(false);
      setRenaming(p.id);
      setRenameValue(p.label);
    }
  }
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function remove(p: ProfileSummary) {
    Alert.alert(t("companyProfiles", "deleteConfirmTitle"), t("companyProfiles", "deleteConfirmBody"), [
      { text: t("companyProfiles", "cancelBtn"), style: "cancel" },
      {
        text: t("companyProfiles", "deleteBtn"),
        style: "destructive",
        onPress: async () => {
          try {
            await endpoints.companyProfileDelete(p.id);
            await load();
          } catch (e) {
            Alert.alert(t("companyProfiles", "lastProfileError"), e instanceof Error ? e.message : "");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("companyProfiles", "screenTitle")}</Text>
        <View style={{ width: 24 }} />
      </View>
      <AppScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {profiles.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{p.label}</Text>
                  {p.isDefault && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>★ {t("companyProfiles", "defaultBadge")}</Text>
                    </View>
                  )}
                </View>
                {p.ico ? <Text style={styles.cardSub}>IČO {p.ico}</Text> : null}

                {renaming === p.id ? (
                  <View style={styles.renameRow}>
                    <TextInput
                      value={renameValue}
                      onChangeText={setRenameValue}
                      style={styles.input}
                      autoFocus
                    />
                    <Pressable
                      style={styles.primaryBtnSm}
                      onPress={async () => {
                        if (renameValue.trim()) {
                          await endpoints.companyProfileUpdate(p.id, { label: renameValue.trim() });
                          setRenaming(null);
                          await load();
                        }
                      }}
                    >
                      <Text style={styles.primaryBtnText}>OK</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  style={styles.row}
                  onPress={() => router.push({ pathname: "/(tabs)/settings/company-profile", params: { profileId: p.id } })}
                >
                  <Ionicons name="business-outline" size={18} color={colors.textSubtle} />
                  <Text style={styles.rowText}>{t("companyProfiles", "profileRow")}</Text>
                  <Ionicons name={p.hasCompanyMd ? "checkmark-circle" : "ellipse-outline"} size={16} color={p.hasCompanyMd ? colors.success : colors.textSubtle} />
                </Pressable>
                <Pressable
                  style={styles.row}
                  onPress={() => router.push({ pathname: "/(tabs)/settings/bid-identity", params: { profileId: p.id } })}
                >
                  <Ionicons name="id-card-outline" size={18} color={colors.textSubtle} />
                  <Text style={styles.rowText}>{t("companyProfiles", "identityRow")}</Text>
                  <Ionicons name={p.bidIdentityComplete ? "checkmark-circle" : "ellipse-outline"} size={16} color={p.bidIdentityComplete ? colors.success : colors.textSubtle} />
                </Pressable>

                <View style={styles.actions}>
                  {!p.isDefault && (
                    <Pressable onPress={() => setDefault(p)} disabled={busy}>
                      <Text style={styles.actionLink}>{t("companyProfiles", "setDefault")}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => rename(p)}>
                    <Text style={styles.actionLink}>{t("companyProfiles", "rename")}</Text>
                  </Pressable>
                  {profiles.length > 1 && (
                    <Pressable onPress={() => remove(p)}>
                      <Text style={[styles.actionLink, { color: colors.danger }]}>{t("companyProfiles", "deleteBtn")}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            {profiles.length < maxProfiles && !adding && (
              <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
                <Ionicons name="add" size={18} color={colors.accent} />
                <Text style={styles.addBtnText}>{t("companyProfiles", "addBtn")}</Text>
              </Pressable>
            )}
            {adding && (
              <View style={styles.card}>
                <Text style={styles.cardSub}>{t("companyProfiles", "addNote")}</Text>
                <TextInput
                  value={newLabel}
                  onChangeText={setNewLabel}
                  placeholder={t("companyProfiles", "labelPlaceholder")}
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
                <TextInput
                  value={newIco}
                  onChangeText={setNewIco}
                  placeholder={t("companyProfiles", "icoPlaceholder")}
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  keyboardType="number-pad"
                />
                <Pressable style={styles.primaryBtn} onPress={create} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t("companyProfiles", "createBtn")}</Text>}
                </Pressable>
              </View>
            )}
          </>
        )}
      </AppScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, flexShrink: 1 },
    cardSub: { fontSize: fontSize.sm, color: colors.textSubtle },
    badge: {
      backgroundColor: colors.successBg,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { fontSize: fontSize.xs, color: colors.success, fontWeight: "600" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    rowText: { flex: 1, fontSize: fontSize.sm, color: colors.text },
    actions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs, flexWrap: "wrap" },
    actionLink: { fontSize: fontSize.sm, color: colors.accent, fontWeight: "600" },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
    },
    addBtnText: { color: colors.accent, fontWeight: "600", fontSize: fontSize.sm },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      fontSize: fontSize.sm,
      backgroundColor: colors.bg,
    },
    renameRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      alignItems: "center",
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    primaryBtnSm: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    primaryBtnText: { color: colors.accentForeground, fontWeight: "700", fontSize: fontSize.sm },
  });
}
