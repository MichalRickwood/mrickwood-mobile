import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { endpoints, type BidIdentityView } from "@/lib/endpoints";

export default function BidIdentityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BidIdentityView | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bank, setBank] = useState("");
  const [dataBox, setDataBox] = useState("");
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [signatories, setSignatories] = useState<{ name: string; function: string }[]>([]);

  function hydrate(v: BidIdentityView) {
    setView(v);
    setBank(v.bankAccount ?? "");
    setDataBox(v.dataBox ?? "");
    setCName(v.contactPerson?.name ?? "");
    setCEmail(v.contactPerson?.email ?? "");
    setCPhone(v.contactPerson?.phone ?? "");
    // Migrace ze starého `signatory` (single) na pole.
    const sigs = v.signatories?.length
      ? v.signatories
      : v.signatory?.name
        ? [{ name: v.signatory.name, function: v.signatory.function }]
        : [];
    setSignatories(sigs.map((s) => ({ name: s.name, function: s.function })));
  }

  const updateSig = (i: number, patch: Partial<{ name: string; function: string }>) =>
    setSignatories((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSig = () => setSignatories((arr) => [...arr, { name: "", function: "jednatel" }]);
  const removeSig = (i: number) => setSignatories((arr) => arr.filter((_, idx) => idx !== i));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await endpoints.bidIdentityGet();
        if (alive) hydrate(data);
      } catch (e) {
        if (alive) Alert.alert(t("bidIdentity", "errorTitle"), e instanceof Error ? e.message : "");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function enrich() {
    if (enriching) return;
    setEnriching(true);
    try {
      const { data } = await endpoints.bidIdentityEnrich();
      hydrate(data);
    } catch (e) {
      Alert.alert(t("bidIdentity", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setEnriching(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await endpoints.bidIdentitySave({
        bankAccount: bank.trim() || undefined,
        dataBox: dataBox.trim() || undefined,
        contactPerson: { name: cName.trim(), email: cEmail.trim(), phone: cPhone.trim() },
        signatories: signatories
          .map((s) => ({ name: s.name.trim(), function: s.function.trim() || "jednatel" }))
          .filter((s) => s.name),
      });
      hydrate(data);
      Alert.alert(t("bidIdentity", "savedTitle"), t("bidIdentity", "savedBody"));
    } catch (e) {
      Alert.alert(t("bidIdentity", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}><ActivityIndicator color={colors.textSubtle} /></View>
      </SafeAreaView>
    );
  }

  if (!view?.ico) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>{t("bidIdentity", "noIcoTitle")}</Text>
          <Text style={styles.gateBody}>{t("bidIdentity", "noIcoBody")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)/settings/billing")}>
            <Text style={styles.primaryBtnText}>{t("bidIdentity", "noIcoCta")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.statusBadge, view.complete ? styles.badgeOk : styles.badgeWarn]}>
          <Text style={[styles.badgeText, view.complete ? styles.badgeTextOk : styles.badgeTextWarn]}>
            {view.complete ? t("bidIdentity", "complete") : t("bidIdentity", "incomplete")}
          </Text>
        </View>

        {/* ARES */}
        <Text style={styles.companyName}>{view.name ?? view.ico}</Text>
        <Text style={styles.companySub}>
          {[view.ico ? `IČO ${view.ico}` : null, view.dic, view.address].filter(Boolean).join(" · ")}
        </Text>
        <Pressable style={[styles.secondaryBtn, enriching && { opacity: 0.6 }]} disabled={enriching} onPress={enrich}>
          {enriching ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.secondaryBtnText}>{t("bidIdentity", "aresBtn")}</Text>}
        </Pressable>
        <Text style={styles.hint}>{t("bidIdentity", "aresHint")}</Text>

        <Field styles={styles} label={t("bidIdentity", "bankLabel")} value={bank} onChange={setBank} placeholder="123456789/0100" colors={colors} />
        <Field styles={styles} label={t("bidIdentity", "dataBoxLabel")} value={dataBox} onChange={setDataBox} placeholder="abc123" colors={colors} />

        <Text style={styles.sectionLabel}>{t("bidIdentity", "contactLabel")}</Text>
        <Field styles={styles} label={t("bidIdentity", "contactName")} value={cName} onChange={setCName} colors={colors} />
        <Field styles={styles} label={t("bidIdentity", "contactEmail")} value={cEmail} onChange={setCEmail} keyboardType="email-address" colors={colors} />
        <Field styles={styles} label={t("bidIdentity", "contactPhone")} value={cPhone} onChange={setCPhone} keyboardType="phone-pad" colors={colors} />

        <Text style={styles.sectionLabel}>{t("bidIdentity", "signatoryLabel")}</Text>
        {signatories.length === 0 && <Text style={styles.hint}>{t("bidIdentity", "signatoryEmpty")}</Text>}
        {signatories.map((s, i) => (
          <View key={i} style={styles.sigCard}>
            <View style={styles.sigHead}>
              <Text style={styles.sigIndex}>{t("bidIdentity", "signatoryPerson")} {i + 1}</Text>
              <Pressable onPress={() => removeSig(i)} hitSlop={8}>
                <Text style={styles.sigRemove}>{t("bidIdentity", "remove")}</Text>
              </Pressable>
            </View>
            <Field styles={styles} label={t("bidIdentity", "signatoryName")} value={s.name} onChange={(v) => updateSig(i, { name: v })} colors={colors} />
            <Field styles={styles} label={t("bidIdentity", "signatoryFunction")} value={s.function} onChange={(v) => updateSig(i, { function: v })} colors={colors} />
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={addSig}>
          <Text style={styles.addBtnText}>＋ {t("bidIdentity", "addSignatory")}</Text>
        </Pressable>

        <Pressable style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
          {saving ? <ActivityIndicator size="small" color={colors.accentForeground} /> : <Text style={styles.primaryBtnText}>{t("bidIdentity", "saveBtn")}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  styles,
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  colors,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  colors: Colors;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    gateTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.text, marginBottom: spacing.sm, textAlign: "center" },
    gateBody: { fontSize: fontSize.sm, color: c.textSubtle, textAlign: "center", marginBottom: spacing.xl, lineHeight: 20 },
    statusBadge: { alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, marginBottom: spacing.md },
    badgeOk: { backgroundColor: c.successBg },
    badgeWarn: { backgroundColor: c.warningBg },
    badgeText: { fontSize: fontSize.xs, fontWeight: "700" },
    badgeTextOk: { color: c.success },
    badgeTextWarn: { color: c.warning },
    companyName: { fontSize: fontSize.base, fontWeight: "700", color: c.text },
    companySub: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs, marginBottom: spacing.md },
    secondaryBtn: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: c.card },
    secondaryBtnText: { fontSize: fontSize.sm, color: c.text, fontWeight: "600" },
    hint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs, lineHeight: 16 },
    sectionLabel: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.xs },
    field: { marginTop: spacing.sm },
    fieldLabel: { fontSize: fontSize.xs, color: c.textMuted, marginBottom: spacing.xs },
    input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: c.text },
    sigCard: { marginTop: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.card },
    sigHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sigIndex: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    sigRemove: { fontSize: fontSize.xs, color: c.danger ?? c.warning, fontWeight: "600" },
    addBtn: { marginTop: spacing.sm, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center" },
    addBtnText: { fontSize: fontSize.sm, color: c.accent, fontWeight: "600" },
    primaryBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
    primaryBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
  });
