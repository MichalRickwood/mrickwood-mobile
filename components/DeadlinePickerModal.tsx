import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, LocaleConfig, type DateData } from "react-native-calendars";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

LocaleConfig.locales["cs"] = {
  monthNames: [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
  ],
  monthNamesShort: ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"],
  dayNames: ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"],
  dayNamesShort: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
  today: "Dnes",
};
LocaleConfig.defaultLocale = "cs";

interface Props {
  visible: boolean;
  initialFrom: string | null;
  initialTo: string | null;
  onClose: () => void;
  onApply: (from: string | null, to: string | null) => void;
}

/** Vrátí všechny dny mezi from a to (včetně) jako YYYY-MM-DD pole. */
function daysBetween(from: string, to: string): string[] {
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function DeadlinePickerModal({
  visible,
  initialFrom,
  initialTo,
  onClose,
  onApply,
}: Props) {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);

  useEffect(() => {
    if (visible) {
      setFrom(initialFrom);
      setTo(initialTo);
    }
  }, [visible, initialFrom, initialTo]);

  function pick(day: DateData) {
    const d = day.dateString; // YYYY-MM-DD
    // State machine:
    // - žádný start → set from
    // - start, žádný end → if d < from, set from. Else set to.
    // - both set → reset, set as new from
    if (!from || (from && to)) {
      setFrom(d);
      setTo(null);
      return;
    }
    if (d < from) {
      setFrom(d);
      return;
    }
    if (d === from) {
      setTo(d);
      return;
    }
    setTo(d);
  }

  const markedDates = useMemo(() => {
    const m: Record<string, {
      startingDay?: boolean;
      endingDay?: boolean;
      color?: string;
      textColor?: string;
      selected?: boolean;
    }> = {};
    if (from && !to) {
      m[from] = { startingDay: true, endingDay: true, color: colors.accent, textColor: colors.accentForeground };
    } else if (from && to) {
      const days = daysBetween(from, to);
      days.forEach((d, idx) => {
        m[d] = {
          color: colors.accent,
          textColor: colors.accentForeground,
          startingDay: idx === 0,
          endingDay: idx === days.length - 1,
        };
      });
    }
    return m;
  }, [from, to, colors]);

  const rangeText = useMemo(() => {
    if (!from && !to) return "Vyberte rozsah dnů";
    const fmt = (iso: string) => {
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
    };
    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    if (from) return `Od ${fmt(from)} (zvolte konec)`;
    return `Do ${fmt(to!)}`;
  }, [from, to]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Lhůta podání</Text>
          <Text style={styles.range}>{rangeText}</Text>
          <Calendar
            current={from ?? to ?? undefined}
            minDate={new Date().toISOString().slice(0, 10)}
            onDayPress={pick}
            markedDates={markedDates}
            markingType="period"
            firstDay={1}
            enableSwipeMonths
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.textSubtle,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              arrowColor: colors.text,
              textDisabledColor: colors.textFaint,
              todayTextColor: colors.link,
              selectedDayBackgroundColor: colors.accent,
              selectedDayTextColor: colors.accentForeground,
              textDayFontSize: 14,
              textMonthFontSize: 15,
              textDayHeaderFontSize: 12,
              textMonthFontWeight: "600",
            }}
            key={isDark ? "dark" : "light"}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                setFrom(null);
                setTo(null);
                onApply(null, null);
                onClose();
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>{t("matches", "adHocClear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onApply(from, to);
                onClose();
              }}
              style={styles.applyBtn}
            >
              <Text style={styles.applyBtnText}>{t("matches", "adHocApply")}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    range: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    clearBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearBtnText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    applyBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    applyBtnText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
  });
