import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import CountryField from "@/components/CountryField";
import CompanyLookupField, { type CompanyLookupResult } from "@/components/CompanyLookupField";
import DateRangeField from "@/components/DateRangeField";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export type Role = "dodavatel" | "zadavatel";
export interface VyberFirmy { country: string; ident: string; nazev: string; kind: Role; od?: string; do?: string }

/**
 * Okno zespoda pro profil firmy: firma (předvyplněná, klepnutí na × smaže a píše se nová),
 * role dodavatel / zadavatel a období od–do. „Použít" přepne celý profil.
 */
export default function ReportyFirmaSheet({ visible, initial, onClose, onApply }: {
  visible: boolean; initial: VyberFirmy; onClose: () => void; onApply: (v: VyberFirmy) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [v, setV] = useState<VyberFirmy>(initial);
  useEffect(() => { if (visible) setV(initial); }, [visible, initial]);

  const zvol = (r: CompanyLookupResult) => {
    const kind: Role = !r.jeDodavatel && r.jeZadavatel ? "zadavatel" : v.kind;
    setV({ ...v, country: r.country || v.country, ident: r.taxId || r.name, nazev: r.name, kind });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.sheetWrap} pointerEvents="box-none">
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{t("admin", "repFirmaVybrat")}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
            <CountryField label={t("admin", "repCountry")} value={v.country} onChange={(c) => setV({ ...v, country: c })} />
            <CompanyLookupField
              zdroj="reporty"
              country={v.country}
              value={v.ident}
              resolvedName={v.nazev}
              label={t("admin", "repSubjQ")}
              placeholder={t("admin", "repSubjQPh")}
              onResolve={zvol}
              onClear={() => setV({ ...v, ident: "", nazev: "" })}
            />
            <Text style={s.label}>{t("admin", "repRoleVyber")}</Text>
            <View style={s.roles}>
              {(["dodavatel", "zadavatel"] as Role[]).map((r) => (
                <Pressable key={r} onPress={() => setV({ ...v, kind: r })} style={[s.roleBtn, v.kind === r && s.roleBtnOn]}>
                  <Text style={[s.roleText, v.kind === r && s.roleTextOn]}>{r === "dodavatel" ? t("admin", "repSupplier") : t("admin", "repBuyer")}</Text>
                </Pressable>
              ))}
            </View>
            <DateRangeField od={v.od} do={v.do} onChange={(od, doD) => setV({ ...v, od, do: doD })} />
          </ScrollView>
          <View style={s.actions}>
            <TouchableOpacity onPress={onClose} style={s.btnSecondary}><Text style={s.btnSecondaryText}>{t("admin", "repZavrit")}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { if (v.ident) { onApply(v); onClose(); } }} disabled={!v.ident} style={[s.btnPrimary, !v.ident && { opacity: 0.5 }]}>
              <Text style={s.btnPrimaryText}>{t("admin", "repPouzit")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    sheetWrap: { flex: 1, justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: "88%" },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.sm, marginBottom: 4 },
    roles: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
    roleBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 8, alignItems: "center", backgroundColor: colors.card },
    roleBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    roleText: { fontSize: fontSize.sm, color: colors.text },
    roleTextOn: { color: colors.accentForeground, fontWeight: "600" },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    btnSecondary: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    btnSecondaryText: { color: colors.text, fontSize: fontSize.base },
    btnPrimary: { flex: 2, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
  });
