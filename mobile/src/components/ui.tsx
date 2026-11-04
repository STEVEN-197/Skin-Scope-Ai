import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors, commonStyles } from '../theme';

export function SliderBar({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const steps: number[] = [];
  const totalSteps = Math.round((max - min) / step);
  if (totalSteps <= 15) {
    for (let v = min; v <= max; v += step) {
      steps.push(+v.toFixed(1));
    }
  } else {
    // For wider ranges (e.g. 0-180 exercise minutes), provide 10 quick stops + -/+ buttons
    const count = 9;
    for (let i = 0; i <= count; i++) {
      const raw = min + ((max - min) * i) / count;
      steps.push(Math.round(raw / step) * step);
    }
  }

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.stepsRow}>
        <TouchableOpacity
          style={styles.stepAdjust}
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
        >
          <Text style={styles.stepAdjustText}>−</Text>
        </TouchableOpacity>
        <View style={styles.chipsWrap}>
          {steps.map((s) => {
            const active = Math.abs(value - s) < step / 2;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => onChange(s)}
                style={[styles.stepDot, active && styles.stepDotActive]}
              >
                <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.stepAdjust}
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
        >
          <Text style={styles.stepAdjustText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <View style={styles.disclaimer}>
      <AlertTriangle size={16} color={colors.warning} style={{ marginTop: 1 }} />
      <Text style={styles.disclaimerText}>{text}</Text>
    </View>
  );
}

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primaryGlow,
    borderRadius: 4,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  stepDot: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  stepDotTextActive: {
    color: '#FFF',
  },
  stepAdjust: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepAdjustText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  disclaimerText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  chipActive: {
    borderColor: colors.primaryGlow,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  chipText: {
    fontSize: 12.5,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
});
