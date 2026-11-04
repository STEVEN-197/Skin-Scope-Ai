import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { FileText, Plus, Sparkles } from 'lucide-react-native';
import { supabase } from '../../../src/integrations/supabase/client';
import { useAuth } from '../../../src/lib/auth-context';
import { SeverityBadge } from '../../../src/components/SeverityBadge';
import { colors, commonStyles } from '../../../src/theme';

interface Row {
  id: string;
  region: string;
  condition: string;
  severity: string;
  confidence: number;
  created_at: string;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default function ReportsListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, region, condition, severity, confidence, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setReports(data as Row[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
            Reports
          </Text>
          <Text style={[commonStyles.h1, { marginTop: 2 }]}>Your full history</Text>
          <Text style={commonStyles.subtitle}>All analyses, ordered by date.</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/dashboard/analyze')}
        >
          <Plus size={16} color="#FFF" />
          <Text style={styles.newBtnText}>New analysis</Text>
        </TouchableOpacity>
      </View>

      <View style={commonStyles.card}>
        {loading ? (
          <Text style={[commonStyles.subtitle, { textAlign: 'center', paddingVertical: 28 }]}>
            Loading…
          </Text>
        ) : reports.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <View style={styles.iconCircle}>
              <Sparkles size={20} color={colors.primaryGlow} />
            </View>
            <Text style={commonStyles.h3}>No reports yet</Text>
            <Text style={commonStyles.subtitle}>Run your first analysis to get started.</Text>
            <TouchableOpacity
              style={[styles.newBtn, { marginTop: 8 }]}
              onPress={() => router.push('/dashboard/analyze')}
            >
              <Text style={styles.newBtnText}>Start analysis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {reports.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.itemRow}
                onPress={() => router.push(`/dashboard/reports/${r.id}` as any)}
              >
                <View style={[commonStyles.row, { gap: 12, flex: 1 }]}>
                  <View style={styles.iconCircle}>
                    <FileText size={16} color={colors.primaryGlow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={commonStyles.h3} numberOfLines={1}>
                      {r.condition}
                    </Text>
                    <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                      {capitalize(r.region)} · {format(new Date(r.created_at), 'MMM d, yyyy · HH:mm')}
                    </Text>
                  </View>
                </View>
                <View style={[commonStyles.row, { gap: 8 }]}>
                  <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                    {Math.round(Number(r.confidence))}%
                  </Text>
                  <SeverityBadge severity={r.severity} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
