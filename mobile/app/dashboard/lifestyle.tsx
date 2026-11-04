import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { Heart, Save } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { SliderBar } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface Log {
  log_date: string;
  sleep_hours: number | null;
  water_glasses: number | null;
  stress_level: number | null;
  exercise_minutes: number | null;
  diet_quality: number | null;
}

export default function LifestyleScreen() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [sleep, setSleep] = useState<number>(7);
  const [water, setWater] = useState<number>(6);
  const [stress, setStress] = useState<number>(5);
  const [exercise, setExercise] = useState<number>(20);
  const [diet, setDiet] = useState<number>(6);
  const [recent, setRecent] = useState<Log[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('lifestyle_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(7);
    setRecent((data ?? []) as Log[]);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('lifestyle_logs').upsert(
      {
        user_id: user.id,
        log_date: date,
        sleep_hours: sleep,
        water_glasses: water,
        stress_level: stress,
        exercise_minutes: exercise,
        diet_quality: diet,
      },
      { onConflict: 'user_id,log_date' },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Lifestyle log saved');
    load();
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <Heart size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Lifestyle</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Daily inputs help correlate sleep, hydration, and stress with your scans and symptoms.
        </Text>
      </View>

      <View style={[commonStyles.card, { gap: 16 }]}>
        <View>
          <Text style={commonStyles.h2}>Log today</Text>
          <Text style={commonStyles.subtitle}>Quick 30-second entry.</Text>
        </View>

        <View>
          <Text style={commonStyles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder={today}
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>

        <SliderField
          label="Sleep (hours)"
          value={sleep}
          onChange={setSleep}
          min={0}
          max={12}
          step={0.5}
          suffix="h"
        />
        <SliderField
          label="Water (glasses)"
          value={water}
          onChange={setWater}
          min={0}
          max={15}
          step={1}
          suffix=" glasses"
        />
        <SliderField
          label="Stress level"
          value={stress}
          onChange={setStress}
          min={0}
          max={10}
          step={1}
          suffix="/10"
        />
        <SliderField
          label="Exercise (minutes)"
          value={exercise}
          onChange={setExercise}
          min={0}
          max={180}
          step={10}
          suffix=" min"
        />
        <SliderField
          label="Diet quality"
          value={diet}
          onChange={setDiet}
          min={0}
          max={10}
          step={1}
          suffix="/10"
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Save size={16} color="#FFF" />
          )}
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={[commonStyles.card, { gap: 10 }]}>
        <Text style={commonStyles.h2}>Last 7 days</Text>
        {recent.length === 0 ? (
          <Text style={commonStyles.subtitle}>No logs yet.</Text>
        ) : (
          recent.map((l) => (
            <View key={l.log_date} style={styles.logRow}>
              <Text style={commonStyles.h3}>{format(new Date(l.log_date), 'MMM d')}</Text>
              <Text style={styles.logMetric}>💤 {l.sleep_hours ?? '—'}h</Text>
              <Text style={styles.logMetric}>💧 {l.water_glasses ?? '—'}</Text>
              <Text style={styles.logMetric}>😰 {l.stress_level ?? '—'}/10</Text>
              <Text style={styles.logMetric}>🏃 {l.exercise_minutes ?? '—'}m</Text>
              <Text style={styles.logMetric}>🥗 {l.diet_quality ?? '—'}/10</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={commonStyles.rowBetween}>
        <Text style={commonStyles.h3}>{label}</Text>
        <Text style={{ color: colors.primaryGlow, fontWeight: '700', fontSize: 13 }}>
          {value}
          {suffix}
        </Text>
      </View>
      <SliderBar min={min} max={max} step={step} value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logMetric: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
});
