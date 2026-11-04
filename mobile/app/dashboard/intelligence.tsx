import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface Insight {
  summary: string;
  observations: { title: string; detail: string; level: string }[];
  trends: { metric: string; direction: string; note: string }[];
  recommendations: { title: string; detail: string; category: string }[];
  generated_at?: string;
}

export default function IntelligenceScreen() {
  const { user } = useAuth();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadLatest = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('health_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setInsight({
        summary: (data as any).summary,
        observations: (data as any).observations ?? [],
        trends: (data as any).trends ?? [],
        recommendations: (data as any).recommendations ?? [],
        generated_at: (data as any).generated_at,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLatest();
  }, [user?.id]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsight({
        summary: data.summary,
        observations: data.observations ?? [],
        trends: data.trends ?? [],
        recommendations: data.recommendations ?? [],
        generated_at: new Date().toISOString(),
      });
      toast.success('New insights generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.rowBetween}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={[commonStyles.row, { gap: 8 }]}>
            <Sparkles size={24} color={colors.primaryGlow} />
            <Text style={commonStyles.h1}>AI Intelligence</Text>
          </View>
          <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
            Predictive observations correlating your scans, lab reports, and symptom diary.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.genBtn, generating && { opacity: 0.6 }]}
          disabled={generating}
          onPress={generate}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <RefreshCw size={15} color="#FFF" />
          )}
          <Text style={styles.genBtnText}>{insight ? 'Regenerate' : 'Generate'}</Text>
        </TouchableOpacity>
      </View>

      <DisclaimerBanner text="AI-assisted observations only — not a medical diagnosis or prediction. Always consult a licensed healthcare professional." />

      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryGlow} />
      ) : !insight ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.h3}>No insights yet</Text>
          <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
            Tap &quot;Generate&quot; once you have at least one scan, lab report, or diary entry.
          </Text>
        </View>
      ) : (
        <>
          <View style={[commonStyles.cardStrong, { gap: 8 }]}>
            <Text style={commonStyles.h2}>Summary</Text>
            {insight.generated_at && (
              <Text style={[commonStyles.subtitle, { fontSize: 11 }]}>
                Generated {new Date(insight.generated_at).toLocaleString()}
              </Text>
            )}
            <Text style={[commonStyles.subtitle, { color: colors.foreground }]}>
              {insight.summary}
            </Text>
          </View>

          {insight.observations.length > 0 && (
            <View style={[commonStyles.card, { gap: 10 }]}>
              <Text style={commonStyles.h2}>Multi-modal observations</Text>
              {insight.observations.map((o, i) => (
                <View key={i} style={styles.itemBox}>
                  <View style={[commonStyles.row, { gap: 8, marginBottom: 4 }]}>
                    <View
                      style={[
                        styles.lvlBadge,
                        o.level === 'concern'
                          ? { backgroundColor: colors.destructiveBg }
                          : { backgroundColor: colors.warningBg },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: o.level === 'concern' ? colors.destructive : colors.warning,
                        }}
                      >
                        {o.level}
                      </Text>
                    </View>
                    <Text style={[commonStyles.h3, { flex: 1 }]}>{o.title}</Text>
                  </View>
                  <Text style={commonStyles.subtitle}>{o.detail}</Text>
                </View>
              ))}
            </View>
          )}

          {insight.trends.length > 0 && (
            <View style={[commonStyles.card, { gap: 10 }]}>
              <Text style={commonStyles.h2}>Trends</Text>
              {insight.trends.map((t, i) => (
                <View key={i} style={[styles.itemBox, commonStyles.row, { gap: 10 }]}>
                  {t.direction === 'improving' ? (
                    <TrendingUp size={18} color={colors.success} />
                  ) : t.direction === 'worsening' ? (
                    <TrendingDown size={18} color={colors.destructive} />
                  ) : (
                    <Minus size={18} color={colors.mutedForeground} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={commonStyles.h3}>{t.metric}</Text>
                    <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>{t.note}</Text>
                  </View>
                  <Text style={{ color: colors.primaryGlow, fontSize: 12, fontWeight: '600' }}>
                    {t.direction}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {insight.recommendations.length > 0 && (
            <View style={[commonStyles.card, { gap: 10 }]}>
              <Text style={commonStyles.h2}>Personalized recommendations</Text>
              {insight.recommendations.map((r, i) => (
                <View key={i} style={styles.itemBox}>
                  <Text style={{ color: colors.primaryGlow, fontSize: 11, fontWeight: '700' }}>
                    {r.category?.toUpperCase()}
                  </Text>
                  <Text style={[commonStyles.h3, { marginTop: 2 }]}>{r.title}</Text>
                  <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>{r.detail}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  genBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itemBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  lvlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
