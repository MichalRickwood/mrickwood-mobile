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
  const [sName, setSName] = useState("");
  const [sFunc, setSFunc] = useState("");
  const [sMode, setSMode] = useState<"sole" | "joint">("sole");

  function hydrate(v: BidIdentityView) {
    setView(v);
    setBank(v.bankAccount ?? "");
    setDataBox(v.dataBox ?? "");
    setCName(v.contactPerson?.name ?? "");
    setCEmail(v.contactPerson?.email ?? "");
    setCPhone(v.contactPerson?.phone ?? "");
    setSName(v.signatory?.name ?? "");
    setSFunc(v.signatory?.function ?? "");
    setSMode(v.signatory?.mode ?? "sole");
  }

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
        signatory: sName.trim() ? { name: sName.trim(), function: sFunc.trim(), mode: sMode } : undefined,
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
        <Field styles={styles} label={t("bidIdentity", "signatoryName")} value={sName} onChange={setSName} colors={colors} />
        <Field styles={styles} label={t("bidIdentity", "signatoryFunction")} value={sFunc} onChange={setSFunc} colors={colors} />
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setSMode("sole")} style={[styles.toggle, sMode === "sole" && styles.toggleActive]}>
            <Text style={[styles.toggleText, sMode === "sole" && styles.toggleTextActive]}>{t("bidIdentity", "modeSole")}</Text>
          </Pressable>
          <Pressable onPress={() => setSMode("joint")} style={[styles.toggle, sMode === "joint" && styles.toggleActive]}>
            <Text style={[styles.toggleText, sMode === "joint" && styles.toggleTextActive]}>{t("bidIdentity", "modeJoint")}</Text>
          </Pressable>
        </View>

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
    toggleRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    toggle: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: c.card },
    toggleActive: { borderColor: c.accent, backgroundColor: c.accent },
    toggleText: { fontSize: fontSize.xs, color: c.text, fontWeight: "600" },
    toggleTextActive: { color: c.accentForeground },
    primaryBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
    primaryBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
  });
