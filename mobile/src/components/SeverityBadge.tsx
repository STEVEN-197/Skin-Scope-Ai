import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const labels: Record<string, string> = {
  none: 'Normal',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const key = (severity ?? 'none').toLowerCase();
  const cfg =
    key === 'severe'
      ? { bg: colors.destructiveBg, border: colors.destructiveBorder, text: colors.destructive }
      : key === 'moderate'
        ? { bg: colors.orangeBg, border: colors.orangeBorder, text: colors.orange }
        : key === 'mild'
          ? { bg: colors.warningBg, border: colors.warningBorder, text: colors.warning }
          : { bg: colors.successBg, border: colors.successBorder, text: colors.success };

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.dot, { backgroundColor: cfg.text }]} />
      <Text style={[styles.label, { color: cfg.text }]}>{labels[key] ?? 'Normal'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
