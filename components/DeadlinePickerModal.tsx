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
LocaleConfig.locales["en"] = {
  monthNames: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "Today",
};
LocaleConfig.locales["de"] = {
  monthNames: [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ],
  monthNamesShort: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  dayNames: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  dayNamesShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  today: "Heute",
};
LocaleConfig.locales["sk"] = {
  monthNames: ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"],
  monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"],
  dayNames: ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"],
  dayNamesShort: ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"],
  today: "Dnes",
};
LocaleConfig.locales["fr"] = {
  monthNames: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
  monthNamesShort: ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"],
  dayNames: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  dayNamesShort: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  today: "Aujourd'hui",
};
LocaleConfig.locales["it"] = {
  monthNames: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
  monthNamesShort: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"],
  dayNames: ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"],
  dayNamesShort: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
  today: "Oggi",
};
LocaleConfig.locales["ja"] = {
  monthNames: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  monthNamesShort: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  dayNames: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
  dayNamesShort: ["日", "月", "火", "水", "木", "金", "土"],
  today: "今日",
};
LocaleConfig.locales["pl"] = {
  monthNames: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
  monthNamesShort: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
  dayNames: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
  dayNamesShort: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"],
  today: "Dziś",
};
LocaleConfig.locales["nl"] = {
  monthNames: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
  monthNamesShort: ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
  dayNames: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"],
  dayNamesShort: ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"],
  today: "Vandaag",
};
LocaleConfig.locales["es"] = {
  monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  monthNamesShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  dayNames: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  dayNamesShort: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  today: "Hoy",
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
  const { t, locale } = useI18n();
  // Calendar lib locale podle current app locale (všech 10); neznámé → en (ne cs).
  LocaleConfig.defaultLocale = LocaleConfig.locales[locale] ? locale : "en";
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
    if (!from && !to) return t("filters", "deadlineSelectRange");
    const fmt = (iso: string) => {
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
    };
    if (from && to)
      return t("filters", "deadlineSelected", { from: fmt(from), to: fmt(to) });
    if (from) return t("filters", "deadlineSelectEnd", { date: fmt(from) });
    return t("filters", "deadlineSelectStart", { date: fmt(to!) });
  }, [from, to, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("filters", "deadlineTitle")}</Text>
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
