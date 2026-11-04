import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { Brain, Activity, Droplet, Moon, Sparkles, Heart } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { SeverityBadge } from '../../src/components/SeverityBadge';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

const SEV: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 };

export default function TwinScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<{
    scans: number;
    labs: number;
    diary: number;
    lifestyle: number;
    avgSeverity: number;
    recentScans: any[];
    topTriggers: { name: string; n: number }[];
    avgSleep: number | null;
    avgWater: number | null;
    avgStress: number | null;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [r, m, d, l] = await Promise.all([
        supabase
          .from('reports')
          .select('region,condition,severity,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('medical_reports').select('id').eq('user_id', user.id),
        supabase
          .from('symptom_diary')
          .select('triggers')
          .eq('user_id', user.id)
          .order('entry_date', { ascending: false })
          .limit(60),
        supabase
          .from('lifestyle_logs')
          .select('sleep_hours,water_glasses,stress_level')
          .eq('user_id', user.id)
          .order('log_date', { ascending: false })
          .limit(14),
      ]);
      const scans = (r.data ?? []) as any[];
      const avgSev = scans.length
        ? scans.reduce((s, x) => s + (SEV[x.severity] ?? 0), 0) / scans.length
        : 0;
      const triggerCounts: Record<string, number> = {};
      ((d.data ?? []) as any[]).forEach((row) =>
        (row.triggers ?? []).forEach((t: string) => {
          triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
        }),
      );
      const topTriggers = Object.entries(triggerCounts)
        .map(([name, n]) => ({ name, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5);
      const ll = (l.data ?? []) as any[];
      const avg = (k: string) =>
        ll.length ? ll.reduce((s, x) => s + (Number(x[k]) || 0), 0) / ll.length : null;
      setData({
        scans: scans.length,
        labs: (m.data ?? []).length,
        diary: (d.data ?? []).length,
        lifestyle: ll.length,
        avgSeverity: avgSev,
        recentScans: scans.slice(0, 5),
        topTriggers,
        avgSleep: avg('sleep_hours'),
        avgWater: avg('water_glasses'),
        avgStress: avg('stress_level'),
      });
    })();
  }, [user?.id]);

  if (!data) {
    return (
      <View style={[commonStyles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primaryGlow} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <Brain size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Digital Health Twin</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          A living summary of patterns SkinScope AI has learned from your data.
        </Text>
      </View>

      <DisclaimerBanner text="Pattern observations only — not a diagnosis. For clinical interpretation, consult a healthcare professional." />

      <View style={styles.grid2}>
        <StatBox Icon={Sparkles} label="Visual scans" value={data.scans} />
        <StatBox Icon={Activity} label="Lab reports" value={data.labs} />
        <StatBox Icon={Brain} label="Diary entries" value={data.diary} />
        <StatBox Icon={Heart} label="Lifestyle logs" value={data.lifestyle} />
      </View>

      <View style={[commonStyles.card, { gap: 12 }]}>
        <Text style={commonStyles.h2}>Recurring patterns</Text>
        <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: -8 }]}>
          Memory engine observations
        </Text>

        <View style={styles.patternBox}>
          <View style={commonStyles.rowBetween}>
            <Text style={commonStyles.h3}>Average severity across scans</Text>
            <View style={styles.valPill}>
              <Text style={styles.valPillText}>{data.avgSeverity.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: 4 }]}>
            {data.avgSeverity > 1.5 ? 'Trending in the moderate range' : 'Mostly mild or normal'}
          </Text>
        </View>

        {data.topTriggers.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={commonStyles.h3}>Most reported triggers</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {data.topTriggers.map((t) => (
                <View key={t.name} style={styles.triggerChip}>
                  <Text style={{ color: colors.foreground, fontSize: 12 }}>
                    {t.name} · {t.n}×
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.lifestyle > 0 && (
          <View style={styles.grid2}>
            <MiniBox
              Icon={Moon}
              label="Avg sleep"
              value={data.avgSleep ? `${data.avgSleep.toFixed(1)}h` : '—'}
            />
            <MiniBox
              Icon={Droplet}
              label="Avg water"
              value={data.avgWater ? `${data.avgWater.toFixed(0)} glasses` : '—'}
            />
            <MiniBox
              Icon={Activity}
              label="Avg stress"
              value={data.avgStress ? `${data.avgStress.toFixed(1)}/10` : '—'}
            />
          </View>
        )}
      </View>

      {data.recentScans.length > 0 && (
        <View style={[commonStyles.card, { gap: 8 }]}>
          <Text style={commonStyles.h2}>Recent visual history</Text>
          {data.recentScans.map((s, i) => (
            <View key={i} style={styles.scanRow}>
              <Text style={[commonStyles.h3, { flex: 1 }]}>
                {s.region} · {s.condition}
              </Text>
              <SeverityBadge severity={s.severity} />
              <Text style={[commonStyles.subtitle, { fontSize: 11, marginLeft: 6 }]}>
                {format(new Date(s.created_at), 'MMM d')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatBox({ Icon, label, value }: { Icon: any; label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <View style={commonStyles.rowBetween}>
        <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>{label}</Text>
        <Icon size={16} color={colors.primaryGlow} />
      </View>
      <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700', marginTop: 8 }}>
        {value}
      </Text>
    </View>
  );
}

function MiniBox({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[commonStyles.row, { gap: 6 }]}>
        <Icon size={14} color={colors.mutedForeground} />
        <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>{label}</Text>
      </View>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: 6 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.cardGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  patternBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  valPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  valPillText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  triggerChip: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
