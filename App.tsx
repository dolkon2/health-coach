import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { colors, spacing, borderRadius } from './design/tokens';
import { Button, Card, Text, FidelityIndicator } from './design/components';

export default function App() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator color={colors.sandstone} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      {/* Masthead */}
      <Text variant="label" color={colors.sandstone}>Design tokens · Dark mode</Text>
      <Text variant="displayXl" style={styles.heading}>Trail map{'\n'}meets tide{'\n'}chart</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
        Infrastructure for someone who climbs, surfs, trail runs, and treats the gym and nutrition as serious support for that life.
      </Text>
      <View style={styles.tagRow}>
        <View style={styles.tag}><Text variant="dataSm" color={colors.sandstone}>MacroFactor confidence</Text></View>
        <View style={styles.tag}><Text variant="dataSm" color={colors.olive}>Earth-tone material</Text></View>
        <View style={[styles.tag, { borderColor: colors.border }]}><Text variant="dataSm" color={colors.textMuted}>No neon · No score rings</Text></View>
      </View>

      {/* Colors */}
      <Text variant="label" color={colors.sandstone} style={styles.sectionLabel}>02 — Color</Text>
      <Text variant="displayLg" style={styles.sectionTitle}>Warm charcoal ground</Text>

      <Text variant="label" color={colors.textMuted} style={styles.subsectionLabel}>Ground & structure</Text>
      <View style={styles.colorRow}>
        {([
          ['Bg', colors.bg],
          ['Surface', colors.surface],
          ['Raised', colors.surfaceRaised],
          ['Border', colors.border],
        ] as [string, string][]).map(([name, hex]) => (
          <View key={name} style={styles.colorChip}>
            <View style={[styles.colorSwatch, { backgroundColor: hex, borderColor: colors.border }]} />
            <Text variant="bodySm">{name}</Text>
            <Text variant="dataSm">{hex}</Text>
          </View>
        ))}
      </View>

      <Text variant="label" color={colors.textMuted} style={styles.subsectionLabel}>Earth accents</Text>
      <View style={styles.colorRow}>
        {([
          ['Sandstone', colors.sandstone],
          ['Olive', colors.olive],
          ['Clay', colors.clay],
          ['Slate', colors.slate],
        ] as [string, string][]).map(([name, hex]) => (
          <View key={name} style={styles.colorChip}>
            <View style={[styles.accentSwatch, { backgroundColor: hex }]} />
            <Text variant="bodySm">{name}</Text>
            <Text variant="dataSm">{hex}</Text>
          </View>
        ))}
      </View>

      {/* Typography */}
      <Text variant="label" color={colors.sandstone} style={styles.sectionLabel}>03 — Typography</Text>
      <Text variant="displayLg" style={styles.sectionTitle}>Identity, utility, honesty</Text>

      <Card style={styles.typeCard}>
        <Text variant="dataSm" color={colors.sandstone}>--font-display</Text>
        <Text variant="displayLg" style={{ marginTop: spacing[3] }}>Barlow{'\n'}Condensed</Text>
        <Text variant="bodySm" style={{ marginTop: spacing[3] }}>Section headers, hero stats. Always uppercase, weight 600–700.</Text>
      </Card>
      <View style={styles.typeRow}>
        <Card style={styles.typeCardHalf}>
          <Text variant="dataSm" color={colors.sandstone}>--font-body</Text>
          <Text variant="body" style={{ marginTop: spacing[2] }}>Inter</Text>
          <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: spacing[1] }}>The quiet workhorse</Text>
        </Card>
        <Card style={styles.typeCardHalf}>
          <Text variant="dataSm" color={colors.sandstone}>--font-data</Text>
          <Text variant="dataLg" style={{ marginTop: spacing[2] }}>2940</Text>
          <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: spacing[1] }}>JetBrains Mono</Text>
        </Card>
      </View>

      {/* Type scale */}
      <Card style={styles.scaleCard}>
        <View style={styles.scaleRow}><Text variant="dataSm" color={colors.textMuted}>display-xl · 40</Text><Text variant="displayXl">2940 kcal</Text></View>
        <View style={styles.scaleDivider} />
        <View style={styles.scaleRow}><Text variant="dataSm" color={colors.textMuted}>display-lg · 28</Text><Text variant="displayLg">Today's intake</Text></View>
        <View style={styles.scaleDivider} />
        <View style={styles.scaleRow}><Text variant="dataSm" color={colors.textMuted}>data-lg · 24</Text><Text variant="dataLg">153.5 lbs</Text></View>
        <View style={styles.scaleDivider} />
        <View style={styles.scaleRow}><Text variant="dataSm" color={colors.textMuted}>body · 15</Text><Text variant="body">Oats with milk, banana.</Text></View>
        <View style={styles.scaleDivider} />
        <View style={styles.scaleRow}><Text variant="dataSm" color={colors.textMuted}>label · 11</Text><Text variant="label">Protein · Carbs · Fat</Text></View>
      </Card>

      {/* Fidelity */}
      <Text variant="label" color={colors.sandstone} style={styles.sectionLabel}>06 — Fidelity</Text>
      <Text variant="displayLg" style={styles.sectionTitle}>Confidence is visible</Text>

      <View style={styles.fidelityRow}>
        <Card style={styles.fidelityCard}>
          <View style={styles.fidelityHeader}>
            <Text variant="label">High · ≥0.8</Text>
            <FidelityIndicator level="high" />
          </View>
          <Text variant="bodySm">Full opacity, solid stroke, filled dots.</Text>
          <Text variant="dataSm" color={colors.textMuted} style={{ marginTop: spacing[2] }}>Barcode · scale</Text>
        </Card>
        <Card style={styles.fidelityCard}>
          <View style={styles.fidelityHeader}>
            <Text variant="label">Mid · 0.4–0.8</Text>
            <FidelityIndicator level="mid" />
          </View>
          <Text variant="bodySm">0.7 opacity, hollow ring dots.</Text>
          <Text variant="dataSm" color={colors.textMuted} style={{ marginTop: spacing[2] }}>Text entry · recipe</Text>
        </Card>
        <Card style={styles.fidelityCard}>
          <View style={styles.fidelityHeader}>
            <Text variant="label">Low · {'<'}0.4</Text>
            <FidelityIndicator level="low" />
          </View>
          <Text variant="bodySm">0.45 opacity, dashed stroke.</Text>
          <Text variant="dataSm" color={colors.textMuted} style={{ marginTop: spacing[2] }}>Photo guess · AI</Text>
        </Card>
      </View>

      {/* Buttons */}
      <Text variant="label" color={colors.sandstone} style={styles.sectionLabel}>Buttons</Text>
      <View style={styles.buttonGroup}>
        <Button label="Primary" onPress={() => {}} />
        <Button label="Secondary" onPress={() => {}} variant="secondary" />
        <Button label="Outline" onPress={() => {}} variant="outline" />
        <Button label="Ghost" onPress={() => {}} variant="ghost" />
      </View>

      {/* Tiers */}
      <Text variant="label" color={colors.sandstone} style={styles.sectionLabel}>07 — Tiers</Text>
      <Text variant="displayLg" style={styles.sectionTitle}>Hierarchy is spatial</Text>

      <Card style={styles.tierCard}>
        <View style={[styles.tierRow, styles.tierBorder]}>
          <Text variant="dataSm" color={colors.sandstone} style={styles.tierLabel}>TIER 1</Text>
          <View>
            <Text variant="label" color={colors.textSecondary}>Logged fact</Text>
            <Text variant="dataLg" style={{ marginTop: spacing[1] }}>2940 <Text variant="data" color={colors.textSecondary}>kcal</Text></Text>
          </View>
        </View>
        <View style={[styles.tierRow, styles.tierBorder]}>
          <Text variant="dataSm" color={colors.trendLine} style={styles.tierLabel}>TIER 2</Text>
          <View>
            <Text variant="label" color={colors.textSecondary}>Accumulated trend</Text>
            <Text variant="dataLg" color={colors.trendLine} style={{ marginTop: spacing[1] }}>153.5 <Text variant="data" color={colors.trendLine}>lbs</Text></Text>
          </View>
        </View>
        <View style={styles.tierRow}>
          <Text variant="dataSm" color={colors.slate} style={styles.tierLabel}>TIER 3</Text>
          <View>
            <Text variant="dataSm" color={colors.textMuted}>MODELED · WEARABLE</Text>
            <Text variant="data" color={colors.slate} style={{ marginTop: spacing[1] }}>Recovery 64 · Strain 11.2</Text>
          </View>
        </View>
      </Card>

      <View style={{ height: spacing[12] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing[6],
    paddingTop: 80,
    paddingBottom: spacing[12],
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  subtitle: {
    maxWidth: 340,
    marginBottom: spacing[6],
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[10],
  },
  tag: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  sectionLabel: {
    marginBottom: spacing[2],
    marginTop: spacing[10],
  },
  sectionTitle: {
    marginBottom: spacing[6],
  },
  subsectionLabel: {
    marginBottom: spacing[3],
    marginTop: spacing[4],
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  colorChip: {
    gap: spacing[2],
  },
  colorSwatch: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  accentSwatch: {
    width: 72,
    height: 88,
    borderRadius: borderRadius.sm,
  },
  typeCard: {
    marginBottom: spacing[3],
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  typeCardHalf: {
    flex: 1,
  },
  scaleCard: {
    gap: spacing[4],
  },
  scaleRow: {
    gap: spacing[2],
  },
  scaleDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  fidelityRow: {
    gap: spacing[3],
  },
  fidelityCard: {
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  fidelityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonGroup: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  tierCard: {
    padding: spacing[5],
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[5],
    paddingVertical: spacing[4],
  },
  tierBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tierLabel: {
    width: 48,
  },
});
