import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Save } from 'lucide-react-native';
import { colors, commonStyles } from '../theme';
import { SliderBar } from './ui';

export interface DiaryFormData {
  itch: number;
  pain: number;
  redness: number;
  dryness: number;
  irritation: number;
  swelling: number;
  products_used: string[];
  triggers: string[];
  notes: string;
  entry_date: string;
}

interface SymptomFormProps {
  initial?: Partial<DiaryFormData>;
  onSubmit: (data: DiaryFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const SEVERITY_LABELS = [
  'None',
  'Very mild',
  'Mild',
  'Noticeable',
  'Moderate',
  'Bothering',
  'Strong',
  'Quite bad',
  'Severe',
  'Very severe',
  'Extreme',
];

export function SymptomForm({ initial, onSubmit, onCancel, submitLabel = 'Save entry' }: SymptomFormProps) {
  const initialSeverity =
    initial?.irritation ??
    Math.round(
      ((initial?.itch ?? 0) +
        (initial?.pain ?? 0) +
        (initial?.redness ?? 0) +
        (initial?.dryness ?? 0) +
        (initial?.irritation ?? 0) +
        (initial?.swelling ?? 0)) /
        6,
    );

  const [severity, setSeverity] = useState<number>(initialSeverity || 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [triggersText, setTriggersText] = useState((initial?.triggers ?? []).join(', '));
  const [productsText, setProductsText] = useState((initial?.products_used ?? []).join(', '));
  const [entryDate, setEntryDate] = useState(
    initial?.entry_date ?? new Date().toISOString().split('T')[0],
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const triggers = triggersText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const products_used = productsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await onSubmit({
        itch: severity,
        pain: severity,
        redness: severity,
        dryness: severity,
        irritation: severity,
        swelling: severity,
        products_used,
        triggers,
        notes,
        entry_date: entryDate,
      });
    } finally {
      setSaving(false);
    }
  };

  const badgeTone =
    severity === 0
      ? { bg: colors.successBg, color: colors.success }
      : severity <= 3
        ? { bg: 'rgba(6, 182, 212, 0.18)', color: colors.primaryGlow }
        : severity <= 6
          ? { bg: colors.warningBg, color: colors.warning }
          : { bg: colors.destructiveBg, color: colors.destructive };

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={commonStyles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          value={entryDate}
          onChangeText={setEntryDate}
          placeholder="2026-11-04"
          placeholderTextColor={colors.mutedForeground}
          style={commonStyles.input}
        />
      </View>

      <View>
        <Text style={commonStyles.label}>Today&apos;s journal</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={5}
          placeholder="How are you feeling today? Describe what you noticed about your skin, energy, sleep, or anything else worth remembering…"
          placeholderTextColor={colors.mutedForeground}
          style={[commonStyles.input, { minHeight: 110, textAlignVertical: 'top' }]}
        />
        <Text style={[commonStyles.subtitle, { fontSize: 11, marginTop: 4 }]}>
          Free-form. JARVIS will read these entries to spot patterns over time.
        </Text>
      </View>

      <View style={styles.sliderBox}>
        <View style={commonStyles.rowBetween}>
          <Text style={commonStyles.label}>Overall feeling</Text>
          <View style={[styles.sevPill, { backgroundColor: badgeTone.bg }]}>
            <Text style={[styles.sevText, { color: badgeTone.color }]}>
              {severity} · {SEVERITY_LABELS[severity]}
            </Text>
          </View>
        </View>
        <SliderBar min={0} max={10} step={1} value={severity} onChange={setSeverity} />
        <View style={commonStyles.rowBetween}>
          <Text style={styles.scaleHint}>GREAT</Text>
          <Text style={styles.scaleHint}>DIFFICULT</Text>
        </View>
      </View>

      <View>
        <Text style={commonStyles.label}>Triggers (comma-separated, optional)</Text>
        <TextInput
          value={triggersText}
          onChangeText={setTriggersText}
          placeholder="e.g. Sun exposure, Stress, New detergent"
          placeholderTextColor={colors.mutedForeground}
          style={commonStyles.input}
        />
      </View>

      <View>
        <Text style={commonStyles.label}>Products used (comma-separated, optional)</Text>
        <TextInput
          value={productsText}
          onChangeText={setProductsText}
          placeholder="e.g. Ceramide cream, SPF 50"
          placeholderTextColor={colors.mutedForeground}
          style={commonStyles.input}
        />
      </View>

      <View style={[commonStyles.row, { gap: 10 }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Save size={16} color="#FFF" />
          )}
          <Text style={styles.primaryBtnText}>{submitLabel}</Text>
        </TouchableOpacity>
        {onCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  sevPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sevText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scaleHint: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.8,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.input,
  },
  cancelBtnText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
});
