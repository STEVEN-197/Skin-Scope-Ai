import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line, Text as SvgText } from 'react-native-svg';
import {
  Activity,
  FileText,
  TrendingUp,
  Upload,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Pill,
  Users,
  CalendarClock,
  Brain,
  Share2,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { SeverityBadge } from '../../src/components/SeverityBadge';
import { colors, commonStyles } from '../../src/theme';

interface ReportRow {
  id: string;
  region: string;
  condition: string;
  severity: string;
  confidence: number;
  created_at: string;
  trend: string | null;
}

const SEV_SCORE: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 };

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, region, condition, severity, confidence, created_at, trend')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setReports(data as ReportRow[]);
      setLoading(false);
    })();
  }, [user]);

  const total = reports.length;
  const lastReport = reports[0];
  const avgConfidence =
    total > 0 ? Math.round(reports.reduce((s, r) => s + Number(r.confidence), 0) / total) : 0;
  const avgSev = total
    ? reports.reduce((s, r) => s + (SEV_SCORE[r.severity] ?? 0), 0) / total
    : 0;
  const healthScore = total
    ? Math.max(20, Math.min(99, Math.round(95 - avgSev * 18 + (avgConfidence - 70) * 0.2)))
    : 88;

  const chartData = [...reports].reverse().map((r) => ({
    date: format(new Date(r.created_at), 'MMM d'),
    severity: SEV_SCORE[r.severity] ?? 0,
  }));

  const firstName = (user?.email ?? 'there').split('@')[0].split('.')[0];

  const quickItems = [
    { Icon: Upload, title: 'Scan Analysis', desc: 'AI visual diagnostics', to: '/dashboard/analyze' },
    { Icon: FlaskConical, title: 'Medical Reports', desc: 'OCR lab insights', to: '/dashboard/medical-reports' },
    { Icon: Sparkles, title: 'JARVIS AI', desc: 'Personal assistant', to: '/dashboard/jarvis' },
    { Icon: Activity, title: 'Health Timeline', desc: 'Longitudinal view', to: '/dashboard/timeline' },
    { Icon: Pill, title: 'Prescriptions', desc: 'Medicine intelligence', to: '/dashboard/prescriptions' },
    { Icon: Users, title: 'Family Profiles', desc: 'Whole-household care', to: '/dashboard/family' },
    { Icon: CalendarClock, title: 'Appointments', desc: 'Specialist bookings', to: '/dashboard/appointments' },
    { Icon: Share2, title: 'Doctor Share', desc: 'Export PDF summary', to: '/dashboard/share' },
  ];

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      {/* Hero Welcome */}
      <View style={commonStyles.cardStrong}>
        <View style={styles.welcomePill}>
          <Sparkles size={12} color={colors.primaryGlow} />
          <Text style={styles.welcomePillText}>WELCOME BACK</Text>
        </View>
        <View style={[commonStyles.rowBetween, { marginTop: 10, gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={commonStyles.h1}>
              Hello, <Text style={{ color: colors.primaryGlow }}>{capitalize(firstName)}</Text>
            </Text>
            <Text style={[commonStyles.subtitle, { marginTop: 6 }]}>
              Your AI health intelligence is up to date. JARVIS is monitoring your scans, labs and
              lifestyle patterns.
            </Text>
          </View>
          <HealthScoreRing score={healthScore} />
        </View>

        <View style={[commonStyles.row, { gap: 10, marginTop: 16 }]}>
          <TouchableOpacity
            style={styles.heroPrimaryBtn}
            onPress={() => router.push('/dashboard/analyze')}
          >
            <Upload size={15} color="#FFF" />
            <Text style={styles.heroPrimaryText}>New analysis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroOutlineBtn}
            onPress={() => router.push('/dashboard/jarvis')}
          >
            <Sparkles size={15} color={colors.foreground} />
            <Text style={styles.heroOutlineText}>Ask JARVIS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stat Cards */}
      <View style={styles.grid2}>
        <StatCard
          Icon={FileText}
          label="TOTAL SCANS"
          value={loading ? '—' : String(total)}
          hint="All-time analyses"
        />
        <StatCard
          Icon={Activity}
          label="LATEST SEVERITY"
          value={lastReport ? capitalize(lastReport.severity) : '—'}
          hint={lastReport ? format(new Date(lastReport.created_at), 'MMM d, yyyy') : 'No reports yet'}
        />
        <StatCard
          Icon={TrendingUp}
          label="AVG. CONFIDENCE"
          value={total ? `${avgConfidence}%` : '—'}
          hint="Model certainty"
        />
        <StatCard
          Icon={ShieldCheck}
          label="HEALTH SCORE"
          value={`${healthScore}`}
          hint="AI-composed index"
        />
      </View>

      {/* Quick Access */}
      <View style={{ gap: 10 }}>
        <View>
          <Text style={commonStyles.h2}>Quick access</Text>
          <Text style={commonStyles.subtitle}>Jump into your AI workspace</Text>
        </View>
        <View style={styles.grid2}>
          {quickItems.map((q) => (
            <TouchableOpacity
              key={q.title}
              style={styles.quickCard}
              onPress={() => router.push(q.to as any)}
            >
              <View style={styles.quickIconBox}>
                <q.Icon size={18} color="#FFF" />
              </View>
              <Text style={commonStyles.h3}>{q.title}</Text>
              <Text style={[commonStyles.subtitle, { fontSize: 11, marginTop: 2 }]}>{q.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Severity Trend Chart */}
      <View style={commonStyles.card}>
        <View style={commonStyles.rowBetween}>
          <View>
            <Text style={commonStyles.h2}>Severity trend</Text>
            <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
              0 Normal · 1 Mild · 2 Moderate · 3 Severe
            </Text>
          </View>
          <Brain size={20} color={colors.primaryGlow} />
        </View>
        <View style={{ marginTop: 14 }}>
          {chartData.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
              <TrendingUp size={28} color={colors.mutedForeground} />
              <Text style={[commonStyles.subtitle, { marginTop: 8 }]}>
                Trend appears after your first analysis.
              </Text>
            </View>
          ) : (
            <SeveritySvgChart data={chartData} />
          )}
        </View>
      </View>

      {/* Recent Scans */}
      <View style={commonStyles.card}>
        <View style={commonStyles.rowBetween}>
          <View>
            <Text style={commonStyles.h2}>Recent scans</Text>
            <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>Your latest AI analyses</Text>
          </View>
          <TouchableOpacity
            style={[commonStyles.row, { gap: 4 }]}
            onPress={() => router.push('/dashboard/reports')}
          >
            <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
              View all
            </Text>
            <ArrowRight size={14} color={colors.primaryGlow} />
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          {loading && <Text style={commonStyles.subtitle}>Loading…</Text>}
          {!loading && reports.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
              <View style={styles.quickIconBox}>
                <Sparkles size={22} color="#FFF" />
              </View>
              <Text style={commonStyles.h3}>No scans yet</Text>
              <Text style={commonStyles.subtitle}>Run your first analysis to get started.</Text>
              <TouchableOpacity
                style={[styles.heroPrimaryBtn, { marginTop: 8, paddingHorizontal: 18 }]}
                onPress={() => router.push('/dashboard/analyze')}
              >
                <Text style={styles.heroPrimaryText}>Start analysis</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loading &&
            reports.slice(0, 5).map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.reportRow}
                onPress={() => router.push(`/dashboard/reports/${r.id}` as any)}
              >
                <View style={[commonStyles.row, { gap: 10, flex: 1 }]}>
                  <View style={styles.reportIcon}>
                    <Activity size={16} color={colors.primaryGlow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={commonStyles.h3} numberOfLines={1}>
                      {r.condition}
                    </Text>
                    <Text style={[commonStyles.subtitle, { fontSize: 11 }]}>
                      {capitalize(r.region)} · {format(new Date(r.created_at), 'MMM d · HH:mm')}
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
      </View>

      <Text style={styles.bottomDisclaimer}>
        AI-assisted insights only — not a medical diagnosis. Always consult a healthcare
        professional.
      </Text>
    </ScrollView>
  );
}

function HealthScoreRing({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <View style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={104} height={104} viewBox="0 0 104 104">
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="50%" stopColor={colors.primaryGlow} />
            <Stop offset="100%" stopColor={colors.accent} />
          </LinearGradient>
        </Defs>
        <Circle
          cx="52"
          cy="52"
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          fill="none"
        />
        <Circle
          cx="52"
          cy="52"
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          rotation="-90"
          origin="52, 52"
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '800' }}>{score}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 8, fontWeight: '700' }}>
            HEALTH SCORE
          </Text>
        </View>
      </View>
    </View>
  );
}

function StatCard({
  Icon,
  label,
  value,
  hint,
}: {
  Icon: any;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={commonStyles.rowBetween}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statIconWrap}>
          <Icon size={15} color={colors.primaryGlow} />
        </View>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[commonStyles.subtitle, { fontSize: 11 }]}>{hint}</Text>
    </View>
  );
}

function SeveritySvgChart({ data }: { data: { date: string; severity: number }[] }) {
  const W = 310;
  const H = 150;
  const padL = 24;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const pts = data.map((d, i) => {
    const x = padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padT + plotH - (d.severity / 3) * plotH;
    return { x, y, date: d.date };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="sevFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.primaryGlow} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>
      {[0, 1, 2, 3].map((lvl) => {
        const y = padT + plotH - (lvl / 3) * plotH;
        return (
          <React.Fragment key={lvl}>
            <Line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray="3 5"
            />
            <SvgText x={6} y={y + 4} fill={colors.mutedForeground} fontSize="10">
              {lvl}
            </SvgText>
          </React.Fragment>
        );
      })}
      <Path d={areaPath} fill="url(#sevFill)" />
      <Path d={linePath} stroke={colors.primaryGlow} strokeWidth="2.5" fill="none" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r="3.5" fill={colors.primaryGlow} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  welcomePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  welcomePillText: {
    color: colors.primaryGlow,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  heroPrimaryText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  heroOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  heroOutlineText: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: '600',
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.cardGlass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
  },
  quickCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.cardGlass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  quickIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reportIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDisclaimer: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 4,
  },
});
