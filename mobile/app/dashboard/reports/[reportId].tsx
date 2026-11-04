import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Download,
  Trash2,
  Eye,
  TrendingUp,
  Activity,
  ClipboardList,
} from 'lucide-react-native';
import { supabase } from '../../../src/integrations/supabase/client';
import { useAuth } from '../../../src/lib/auth-context';
import { toast } from '../../../src/lib/toast';
import { generateAndShareSingleScanPdf } from '../../../src/lib/doctor-pdf';
import { SeverityBadge } from '../../../src/components/SeverityBadge';
import { CareRoutine } from '../../../src/components/CareRoutine';
import { DisclaimerBanner } from '../../../src/components/ui';
import { colors, commonStyles } from '../../../src/theme';

interface Report {
  id: string;
  region: string;
  condition: string;
  severity: string;
  confidence: number;
  observations: string | null;
  recommendation: string | null;
  trend: string | null;
  image_path: string;
  color_features: Record<string, number> | null;
  created_at: string;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default function ReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user || !reportId) return;
    (async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .eq('user_id', user.id)
        .single();
      if (error || !data) {
        toast.error('Report not found');
        router.replace('/dashboard/reports');
        return;
      }
      setReport(data as Report);

      const { data: signed } = await supabase.storage
        .from('skin-images')
        .createSignedUrl((data as Report).image_path, 60 * 60);
      if (signed?.signedUrl) setImageUrl(signed.signedUrl);

      setLoading(false);
    })();
  }, [reportId, user, router]);

  const handleDelete = () => {
    if (!report || !user) return;
    Alert.alert('Delete Report', 'Delete this report permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          await supabase.storage.from('skin-images').remove([report.image_path]);
          const { error } = await supabase.from('reports').delete().eq('id', report.id);
          setDeleting(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success('Report deleted');
          router.replace('/dashboard/reports');
        },
      },
    ]);
  };

  const handleDownloadPDF = async () => {
    if (!report) return;
    try {
      await generateAndShareSingleScanPdf(report);
      toast.success('PDF ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF export failed');
    }
  };

  if (loading || !report) {
    return (
      <View style={[commonStyles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primaryGlow} />
      </View>
    );
  }

  const cf = report.color_features ?? null;

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.rowBetween}>
        <TouchableOpacity
          style={[commonStyles.row, { gap: 6 }]}
          onPress={() => router.push('/dashboard/reports')}
        >
          <ArrowLeft size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>
            All reports
          </Text>
        </TouchableOpacity>

        <View style={[commonStyles.row, { gap: 8 }]}>
          <TouchableOpacity style={styles.pdfBtn} onPress={handleDownloadPDF}>
            <Download size={14} color={colors.foreground} />
            <Text style={styles.pdfBtnText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.delBtn}
            onPress={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={14} color={colors.destructive} />
            <Text style={styles.delBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Card */}
      <View style={commonStyles.cardStrong}>
        <View style={commonStyles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
              {capitalize(report.region)} analysis
            </Text>
            <Text style={[commonStyles.h1, { fontSize: 22, marginTop: 4 }]}>
              {report.condition}
            </Text>
            <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: 4 }]}>
              {format(new Date(report.created_at), 'PPP · p')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <SeverityBadge severity={report.severity} />
            <View style={styles.confBox}>
              <Text style={styles.confLabel}>CONFIDENCE</Text>
              <Text style={styles.confValue}>{Math.round(Number(report.confidence))}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Image */}
      <View style={[commonStyles.card, { padding: 10 }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.scanImage} resizeMode="cover" />
        ) : (
          <View style={[styles.scanImage, { backgroundColor: colors.secondary }]} />
        )}
      </View>

      {/* Sections */}
      <SectionCard Icon={Eye} title="Observations" body={report.observations} />
      <SectionCard Icon={TrendingUp} title="Trend" body={report.trend} />
      <SectionCard Icon={ClipboardList} title="Recommendation" body={report.recommendation} accent />

      {/* Care Routine */}
      <CareRoutine
        severity={report.severity}
        condition={report.condition}
        region={report.region}
        trend={report.trend}
      />

      {/* Color Analysis */}
      {cf && (
        <View style={commonStyles.card}>
          <View style={[commonStyles.row, { gap: 8, marginBottom: 12 }]}>
            <Activity size={18} color={colors.primaryGlow} />
            <Text style={commonStyles.h2}>Color analysis</Text>
          </View>
          <View style={styles.grid2}>
            <MetricBox
              label="YELLOW RATIO"
              value={`${cf.yellowRatio ?? 0}%`}
              hint="Indicator of jaundice tone"
            />
            <MetricBox
              label="RED RATIO"
              value={`${cf.redRatio ?? 0}%`}
              hint="Inflammation / burn signal"
            />
            <MetricBox
              label="BRIGHTNESS"
              value={`${cf.brightness ?? 0}/100`}
              hint="Average lightness"
            />
            <MetricBox
              label="AVG RGB"
              value={`(${Math.round(cf.avgR ?? 0)}, ${Math.round(cf.avgG ?? 0)}, ${Math.round(cf.avgB ?? 0)})`}
              hint="Mean pixel color"
            />
          </View>
        </View>
      )}

      <DisclaimerBanner text="Reminder: This report is for educational wellness purposes only and is not a medical diagnosis. Please consult a qualified healthcare professional about any concerning findings." />
    </ScrollView>
  );
}

function SectionCard({
  Icon,
  title,
  body,
  accent,
}: {
  Icon: any;
  title: string;
  body: string | null;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        commonStyles.card,
        accent && {
          borderColor: 'rgba(6, 182, 212, 0.35)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
        },
      ]}
    >
      <View style={[commonStyles.row, { gap: 8, marginBottom: 6 }]}>
        <Icon size={16} color={accent ? colors.primaryGlow : colors.mutedForeground} />
        <Text style={commonStyles.h3}>{title}</Text>
      </View>
      <Text style={[commonStyles.subtitle, { color: colors.foreground }]}>{body || '—'}</Text>
    </View>
  );
}

function MetricBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={[commonStyles.subtitle, { fontSize: 11 }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.input,
  },
  pdfBtnText: {
    color: colors.foreground,
    fontSize: 12.5,
    fontWeight: '600',
  },
  delBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.destructiveBg,
  },
  delBtnText: {
    color: colors.destructive,
    fontSize: 12.5,
    fontWeight: '600',
  },
  confBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  confLabel: {
    color: colors.primaryGlow,
    fontSize: 9,
    fontWeight: '700',
  },
  confValue: {
    color: colors.primaryGlow,
    fontSize: 16,
    fontWeight: '800',
  },
  scanImage: {
    width: '100%',
    height: 300,
    borderRadius: 14,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.mutedSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  metricLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginVertical: 4,
  },
});
