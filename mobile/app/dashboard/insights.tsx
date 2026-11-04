import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { BarChart3, Flame, Package, TrendingUp, Sparkles } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface DiaryEntry {
  id: string;
  entry_date: string;
  itch: number;
  pain: number;
  redness: number;
  dryness: number;
  irritation: number;
  swelling: number;
  products_used: string[];
  triggers: string[];
}

const SYMPTOM_KEYS = ['itch', 'pain', 'redness', 'dryness', 'irritation', 'swelling'] as const;

export default function InsightsScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('symptom_diary')
        .select(
          'id, entry_date, itch, pain, redness, dryness, irritation, swelling, products_used, triggers',
        )
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true })
        .limit(100);
      if (!error && data) setEntries(data as unknown as DiaryEntry[]);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <View style={[commonStyles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={commonStyles.subtitle}>Loading insights…</Text>
      </View>
    );
  }

  if (entries.length < 2) {
    return (
      <ScrollView contentContainerStyle={commonStyles.scrollContent}>
        <View>
          <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
            Trigger insights
          </Text>
          <Text style={[commonStyles.h1, { marginTop: 2 }]}>Patterns & trends</Text>
        </View>
        <View style={[commonStyles.card, { alignItems: 'center', paddingVertical: 32, gap: 8 }]}>
          <Sparkles size={26} color={colors.primaryGlow} />
          <Text style={commonStyles.h3}>Not enough data yet</Text>
          <Text style={[commonStyles.subtitle, { textAlign: 'center' }]}>
            Log at least 2 diary entries to start seeing patterns and trends.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const triggerCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  entries.forEach((e) => {
    (e.triggers ?? []).forEach((t) => {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1;
    });
    (e.products_used ?? []).forEach((p) => {
      productCounts[p] = (productCounts[p] || 0) + 1;
    });
  });

  const topTriggers = Object.entries(triggerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const topProducts = Object.entries(productCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const avgRecent =
    entries.slice(-5).reduce((sum, e) => {
      return sum + SYMPTOM_KEYS.reduce((s, k) => s + e[k], 0) / SYMPTOM_KEYS.length;
    }, 0) / Math.min(5, entries.length);
  const avgOlder =
    entries.slice(0, -5).length > 0
      ? entries.slice(0, -5).reduce((sum, e) => {
          return sum + SYMPTOM_KEYS.reduce((s, k) => s + e[k], 0) / SYMPTOM_KEYS.length;
        }, 0) / entries.slice(0, -5).length
      : avgRecent;
  const trendDir =
    avgRecent < avgOlder - 0.5 ? 'Improving' : avgRecent > avgOlder + 0.5 ? 'Worsening' : 'Stable';

  const recentChart = entries.slice(-14);

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
          Trigger insights
        </Text>
        <Text style={[commonStyles.h1, { marginTop: 2 }]}>Patterns & trends</Text>
        <Text style={commonStyles.subtitle}>
          Based on {entries.length} diary entries — spot what&apos;s helping and what&apos;s not.
        </Text>
      </View>

      <View style={styles.grid3}>
        <View style={styles.statCard}>
          <View style={commonStyles.rowBetween}>
            <Text style={commonStyles.subtitle}>Total entries</Text>
            <BarChart3 size={16} color={colors.primaryGlow} />
          </View>
          <Text style={styles.statVal}>{entries.length}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={commonStyles.rowBetween}>
            <Text style={commonStyles.subtitle}>Symptom trend</Text>
            <TrendingUp size={16} color={colors.primaryGlow} />
          </View>
          <Text style={styles.statVal}>{trendDir}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={commonStyles.rowBetween}>
            <Text style={commonStyles.subtitle}>Top trigger</Text>
            <Flame size={16} color="#F43F5E" />
          </View>
          <Text style={styles.statVal}>
            {topTriggers.length > 0 ? topTriggers[0][0] : 'None logged'}
          </Text>
        </View>
      </View>

      {/* Symptom levels over time */}
      <View style={[commonStyles.card, { gap: 10 }]}>
        <Text style={commonStyles.h2}>Symptom levels over time</Text>
        <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: -6 }]}>
          Last {recentChart.length} entries (peak /10)
        </Text>
        <View style={styles.barsRow}>
          {recentChart.map((e) => {
            const peak = Math.max(...SYMPTOM_KEYS.map((k) => e[k]));
            const hPct = Math.max(8, (peak / 10) * 100);
            return (
              <View key={e.id} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${hPct}%` }]} />
                </View>
                <Text style={styles.barDate}>
                  {format(new Date(e.entry_date + 'T00:00:00'), 'M/d')}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={commonStyles.card}>
        <View style={[commonStyles.row, { gap: 8, marginBottom: 10 }]}>
          <Flame size={16} color="#F43F5E" />
          <Text style={commonStyles.h2}>Common triggers</Text>
        </View>
        {topTriggers.length === 0 ? (
          <Text style={commonStyles.subtitle}>No triggers logged yet.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {topTriggers.map(([name, count]) => (
              <View key={name} style={commonStyles.rowBetween}>
                <Text style={{ color: colors.foreground, fontSize: 13 }}>{name}</Text>
                <Text style={commonStyles.subtitle}>{count}×</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={commonStyles.card}>
        <View style={[commonStyles.row, { gap: 8, marginBottom: 10 }]}>
          <Package size={16} color={colors.primaryGlow} />
          <Text style={commonStyles.h2}>Frequent products</Text>
        </View>
        {topProducts.length === 0 ? (
          <Text style={commonStyles.subtitle}>No products logged yet.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {topProducts.map(([name, count]) => (
              <View key={name} style={commonStyles.rowBetween}>
                <Text style={{ color: colors.foreground, fontSize: 13 }}>{name}</Text>
                <Text style={commonStyles.subtitle}>{count}×</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <DisclaimerBanner text="These insights are based on your self-reported diary data and are intended for personal tracking only. They do not constitute medical analysis or diagnosis." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: colors.cardGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statVal: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 10,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    width: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primaryGlow,
    borderRadius: 6,
  },
  barDate: {
    color: colors.mutedForeground,
    fontSize: 9,
  },
});
