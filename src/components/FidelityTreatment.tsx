/**
 * FidelityTreatment — the signature confidence marker for food logs.
 *
 * A dot whose FORM encodes the fidelity tier — filled (high) → hollow ring (mid)
 * → dotted ring (low) — at the tier's opacity. The continuous 0..1 value never
 * appears as a number; the visual is the whole explanation (brand-kit fidelity
 * rules). The tier→treatment mapping is the pure `fidelityTreatment` in foodLog,
 * so the boundaries live in one place (core's `tierOf`).
 */
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { fidelityTreatment } from '@/lib/foodLog';

export function FidelityTreatment({ fidelity, size = 10 }: { fidelity: number; size?: number }) {
  const theme = useTheme();
  const t = fidelityTreatment(fidelity);
  const base = { width: size, height: size, borderRadius: size / 2, opacity: t.opacity };

  if (t.dot === 'filled') {
    return (
      <View
        accessibilityLabel={`fidelity ${t.tier.toLowerCase()}`}
        style={{ ...base, backgroundColor: theme.colors.sandstone }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`fidelity ${t.tier.toLowerCase()}`}
      style={{
        ...base,
        borderWidth: 1.5,
        borderColor: theme.colors.sandstone,
        borderStyle: t.dot === 'dotted' ? 'dashed' : 'solid',
        backgroundColor: 'transparent',
      }}
    />
  );
}
