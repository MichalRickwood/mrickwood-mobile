import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminInvoice } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { openAuthedFile } from "@/lib/file-open";
import { AdminBadge } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function AdminInvoicesScreen() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [payTarget, setPayTarget] = useState<AdminInvoice | null>(null);
  const [payRef, setPayRef] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useInfiniteQuery({
    queryKey: ["admin-invoices", q],
    placeholderData: keepPreviousData,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => adminApi.listInvoices({ q: q || undefined, page: pageParam }, signal),
    getNextPageParam: (last) => {
      const loaded = last.page * last.pageSize;
      return loaded < last.total ? last.page + 1 : undefined;
    },
  });

  const invoices = useMemo(() => query.data?.pages.flatMap((p) => p.invoices) ?? [], [query.data]);

  const markPaidMutation = useMutation({
    mutationFn: (v: { id: string; ref?: string }) => adminApi.markPaid(v.id, v.ref),
    onSuccess: () => {
      setPayTarget(null);
      setPayRef("");
      void qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function confirmMarkPaid() {
    if (!payTarget) return;
    markPaidMutation.mutate({ id: payTarget.id, ref: payRef.trim() || undefined });
  }

  const renderRow = ({ item }: { item: AdminInvoice }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowHead}>
          <Text style={styles.number}>{item.number}</Text>
          <AdminBadge
            text={item.kind === "PROFORMA" ? t("admin", "kindProforma") : t("admin", "kindTaxDoc")}
            color={colors.textMuted}
            bg={colors.bg}
          />
        </View>
        <Text style={styles.buyer} numberOfLines={1}>
          {item.buyerName}
        </Text>
        <Text style={styles.meta}>
          {item.totalAmount} {item.currency} · {item.status}
          {item.userEmail ? ` · ${item.userEmail}` : ""}
        </Text>
        <View style={styles.actions}>
          {item.hasPdf ? (
            <Pressable
              onPress={() => openAuthedFile(`/api/v2/admin/invoices/${item.id}/pdf`, `${item.number}.pdf`, "application/pdf")}
              style={styles.actionChip}
            >
              <Text style={styles.actionChipText}>{t("admin", "openPdf")}</Text>
            </Pressable>
          ) : null}
          {item.kind === "PROFORMA" && !item.paidDate ? (
            <Pressable onPress={() => setPayTarget(item)} style={[styles.actionChip, styles.payChip]}>
              <Text style={[styles.actionChipText, styles.payChipText]}>{t("admin", "markPaid")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.controls}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t("admin", "searchInvoices")}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(i) => i.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.textSubtle} />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.textSubtle} style={{ margin: spacing.lg }} /> : null}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>{t("admin", "invoicesEmpty")}</Text>
          )
        }
      />

      <Modal visible={!!payTarget} transparent animationType="fade" onRequestClose={() => setPayTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("admin", "markPaidTitle")}</Text>
            <Text style={styles.modalMsg}>{t("admin", "markPaidMsg")}</Text>
            <TextInput
              value={payRef}
              onChangeText={setPayRef}
              placeholder={t("admin", "paymentRefPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPayTarget(null)} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>{t("admin", "cancel")}</Text>
              </Pressable>
              <Pressable onPress={confirmMarkPaid} disabled={markPaidMutation.isPending} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>{t("admin", "confirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    controls: { padding: spacing.lg },
    search: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
    },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    number: { fontSize: fontSize.base, color: colors.text, fontWeight: "700" },
    buyer: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    actionChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    actionChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
    payChip: { backgroundColor: colors.accent, borderColor: colors.accent },
    payChipText: { color: colors.accentForeground },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.xl },
    modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
    modalMsg: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.lg },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.base,
      color: colors.text,
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, marginTop: spacing.lg },
    modalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
    modalBtnPrimary: { backgroundColor: colors.accent },
    modalBtnText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    modalBtnTextPrimary: { color: colors.accentForeground },
  });
