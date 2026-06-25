import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from './design/tokens';
import { Button, Card, Text } from './design/components';

export default function App() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />

      <Text variant="overline" color="textMuted">Health Coach</Text>
      <Text variant="h1" style={styles.heading}>Design System</Text>
      <Text variant="body" color="textSecondary" style={styles.subtitle}>
        Tokens, components, and theme — all in one place.
      </Text>

      {/* Colors */}
      <Text variant="h4" style={styles.sectionTitle}>Colors</Text>
      <View style={styles.colorRow}>
        {([
          ['primary', colors.primary],
          ['accent', colors.accent],
          ['success', colors.success],
          ['warning', colors.warning],
          ['error', colors.error],
        ] as [string, string][]).map(([name, hex]) => (
          <View key={name} style={styles.colorChip}>
            <View style={[styles.colorSwatch, { backgroundColor: hex }]} />
            <Text variant="caption">{name}</Text>
          </View>
        ))}
      </View>

      {/* Typography */}
      <Text variant="h4" style={styles.sectionTitle}>Typography</Text>
      <Card style={styles.card}>
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
        <Text variant="bodyLarge">Body Large — main content text</Text>
        <Text variant="body">Body — default paragraph style</Text>
        <Text variant="bodySmall">Body Small — secondary info</Text>
        <Text variant="label">LABEL</Text>
        <Text variant="caption">Caption — timestamps, hints</Text>
      </Card>

      {/* Buttons */}
      <Text variant="h4" style={styles.sectionTitle}>Buttons</Text>
      <View style={styles.buttonGroup}>
        <Button label="Primary" onPress={() => {}} />
        <Button label="Secondary" onPress={() => {}} variant="secondary" />
        <Button label="Outline" onPress={() => {}} variant="outline" />
        <Button label="Ghost" onPress={() => {}} variant="ghost" />
        <Button label="Loading" onPress={() => {}} loading />
        <Button label="Disabled" onPress={() => {}} disabled />
      </View>

      {/* Cards */}
      <Text variant="h4" style={styles.sectionTitle}>Cards</Text>
      <Card elevation="sm" style={styles.card}>
        <Text variant="h4">Small shadow</Text>
        <Text variant="body" color="textSecondary">Used for list items and inline widgets.</Text>
      </Card>
      <Card elevation="md" style={styles.card}>
        <Text variant="h4">Medium shadow</Text>
        <Text variant="body" color="textSecondary">Used for modals and floating panels.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[6],
    paddingTop: spacing[16],
    paddingBottom: spacing[12],
  },
  heading: {
    marginBottom: spacing[2],
  },
  subtitle: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    marginBottom: spacing[3],
    marginTop: spacing[6],
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  colorChip: {
    alignItems: 'center',
    gap: spacing[1],
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  buttonGroup: {
    gap: spacing[3],
  },
  card: {
    marginBottom: spacing[3],
    gap: spacing[2],
  },
});
