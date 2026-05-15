import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import ProfileSection from "@/components/ProfileSection";
import { useTheme } from "@/lib/theme-context";
import { spacing, type Colors } from "@/constants/theme";

export default function ProfileSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ProfileSection />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
  });
