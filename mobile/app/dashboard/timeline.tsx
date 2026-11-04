import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Activity, FileText, FlaskConical, BookOpen } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { SeverityBadge } from '../../src/components/SeverityBadge';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

type EventKind = 'scan' | 'medical' | 'diary';
interface TimelineEvent {
  id: string;
  kind: EventKind;
  date: string;
  title: string;
  detail: string;
  severity?: string;
  href?: string;
}

const kindMeta: Record<EventKind, { Icon: any; color: string; bg: string; label: string }> = {
  scan: {
    Icon: FileText,
    color: colors.primaryGlow,
    bg: 'rgba(6, 182, 212, 0.15)',
    label: 'Visual scan',
  },
  medical: {
    Icon: FlaskConical,
    color: colors.warning,
    bg: colors.warningBg,
    label: 'Lab report',
  },
  diary: {
    Icon: BookOpen,
    color: colors.success,
    bg: colors.successBg,
    label: 'Diary',
  },
};

export default function TimelineScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [scans, meds, diary] = await Promise.all([
        supabase
          .from('reports')
          .select('id, region, condition, severity, confidence, trend, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('medical_reports')
          .select('id, report_type, summary, ai_analysis, report_date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('symptom_diary')
          .select('id, entry_date, itch, pain, redness, dryness, irritation, swelling, notes, created_at')
          .eq('user_id', user.id)
          .order('entry_date', { ascending: false })
          .limit(50),
      ]);

      const merged: TimelineEvent[] = [];
      (scans.data ?? []).forEach((s: any) =>
        merged.push({
          id: `scan-${s.id}`,
          kind: 'scan',
          date: s.created_at,
          title: `${s.region} scan — ${s.condition}`,
          detail: `Severity: ${s.severity} · Confidence: ${s.confidence}% · Trend: ${s.trend ?? '–'}`,
          severity: s.severity,
          href: `/dashboard/reports/${s.id}`,
        }),
      );
      (meds.data ?? []).forEach((m: any) =>
        merged.push({
          id: `med-${m.id}`,
          kind: 'medical',
          date: (m.report_date as string) || m.created_at,
          title: `${(m.report_type || 'Lab').toUpperCase()} report`,
          detail: m.summary || m.ai_analysis?.plain_language || 'Lab report stored',
          href: '/dashboard/medical-reports',
        }),
      );
      (diary.data ?? []).forEach((d: any) => {
        const max = Math.max(d.itch, d.pain, d.redness, d.dryness, d.irritation, d.swelling);
        merged.push({
          id: `diary-${d.id}`,
          kind: 'diary',
          date: d.entry_date,
          title: 'Symptom diary entry',
          detail: `Peak symptom level: ${max}/10${d.notes ? ` · ${d.notes.slice(0, 80)}` : ''}`,
          href: '/dashboard/diary',
        });
      });

      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(merged);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <Activity size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Health Timeline</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          A unified longitudinal view of every scan, lab report, and diary entry.
        </Text>
      </View>

      <DisclaimerBanner text="Educational AI-assisted view. Not a medical record. For clinical decisions, consult a healthcare professional." />

      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryGlow} />
      ) : events.length === 0 ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.h3}>No events yet</Text>
          <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
            Add a scan, lab report, or diary entry to start building your health timeline.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {events.map((ev) => {
            const meta = kindMeta[ev.kind];
            const Icon = meta.Icon;
            return (
              <TouchableOpacity
                key={ev.id}
                style={[commonStyles.card, { gap: 8 }]}
                onPress={() => ev.href && router.push(ev.href as any)}
              >
                <View style={commonStyles.rowBetween}>
                  <View style={[commonStyles.row, { gap: 8 }]}>
                    <View style={[styles.kindBadge, { backgroundColor: meta.bg }]}>
                      <Icon size={13} color={meta.color} />
                      <Text style={{ color: meta.color, fontSize: 11, fontWeight: '700' }}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[commonStyles.subtitle, { fontSize: 11 }]}>
                      {new Date(ev.date).toLocaleDateString()}
                    </Text>
                  </View>
                  {ev.severity && <SeverityBadge severity={ev.severity} />}
                </View>
                <Text style={commonStyles.h3}>{ev.title}</Text>
                <Text style={commonStyles.subtitle}>{ev.detail}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
