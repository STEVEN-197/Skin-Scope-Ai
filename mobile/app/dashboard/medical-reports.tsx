import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { FlaskConical, Upload, FileText, Trash2 } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { ChipSelect, DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface MedicalReport {
  id: string;
  source_type: string;
  report_type: string | null;
  file_name: string | null;
  summary: string | null;
  extracted_values: any;
  abnormalities: any;
  ai_analysis: any;
  report_date: string | null;
  created_at: string;
}

const REPORT_TYPES = [
  { label: 'Blood test', value: 'blood' },
  { label: 'Liver function', value: 'lft' },
  { label: 'CBC', value: 'cbc' },
  { label: 'Other', value: 'other' },
];

export default function MedicalReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<'upload' | 'manual'>('upload');

  const [pickedFile, setPickedFile] = useState<{
    name: string;
    uri: string;
    mimeType: string;
  } | null>(null);
  const [reportType, setReportType] = useState('blood');
  const [reportDate, setReportDate] = useState('');
  const [manualText, setManualText] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('medical_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setReports((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const handlePickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setPickedFile({
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType || 'application/pdf',
    });
  };

  const handleUpload = async () => {
    if (!user || !pickedFile) {
      toast.error('Please choose a file');
      return;
    }
    setSubmitting(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, {
        encoding: 'base64' as any,
      });
      const path = `${user.id}/${Date.now()}-${pickedFile.name}`;
      const arrayBuffer = decodeBase64(base64);
      const { error: upErr } = await supabase.storage
        .from('medical-reports')
        .upload(path, arrayBuffer, { contentType: pickedFile.mimeType });
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke('analyze-medical-report', {
        body: {
          mode: 'file',
          fileBase64: base64,
          mimeType: pickedFile.mimeType,
          fileName: pickedFile.name,
          reportType,
          reportDate: reportDate || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { error: insErr } = await supabase.from('medical_reports').insert({
        user_id: user.id,
        source_type: 'upload',
        report_type: reportType,
        file_path: path,
        file_name: pickedFile.name,
        mime_type: pickedFile.mimeType,
        extracted_values: data.extracted_values,
        abnormalities: data.abnormalities,
        summary: data.summary,
        ai_analysis: data.ai_analysis,
        report_date: reportDate || null,
      });
      if (insErr) throw insErr;

      toast.success('Report analyzed and saved');
      setPickedFile(null);
      setReportDate('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManual = async () => {
    if (!user || !manualText.trim()) {
      toast.error('Enter some values');
      return;
    }
    setSubmitting(true);
    try {
      const manualValues: Record<string, string> = {};
      manualText.split('\n').forEach((line) => {
        const [k, ...rest] = line.split(':');
        if (k && rest.length) manualValues[k.trim()] = rest.join(':').trim();
      });

      const { data, error } = await supabase.functions.invoke('analyze-medical-report', {
        body: { mode: 'manual', manualValues, reportType, reportDate: reportDate || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { error: insErr } = await supabase.from('medical_reports').insert({
        user_id: user.id,
        source_type: 'manual',
        report_type: reportType,
        extracted_values: data.extracted_values,
        abnormalities: data.abnormalities,
        summary: data.summary,
        ai_analysis: data.ai_analysis,
        report_date: reportDate || null,
      });
      if (insErr) throw insErr;

      toast.success('Values analyzed and saved');
      setManualText('');
      setReportDate('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Analysis failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Report', 'Delete this report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('medical_reports').delete().eq('id', id);
          if (error) toast.error(error.message);
          else load();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <FlaskConical size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Medical Reports</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Upload lab reports (PDF/image) or enter values manually. AI extracts parameters, flags
          abnormalities, and compares to your previous results.
        </Text>
      </View>

      <DisclaimerBanner text="AI-assisted educational summaries only. Not a medical diagnosis. Always consult a licensed healthcare professional for clinical decisions." />

      <View style={[commonStyles.card, { gap: 14 }]}>
        <Text style={commonStyles.h2}>Add a report</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'upload' && styles.tabBtnActive]}
            onPress={() => setTab('upload')}
          >
            <Upload size={14} color={tab === 'upload' ? '#FFF' : colors.mutedForeground} />
            <Text style={[styles.tabText, tab === 'upload' && styles.tabTextActive]}>Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'manual' && styles.tabBtnActive]}
            onPress={() => setTab('manual')}
          >
            <FileText size={14} color={tab === 'manual' ? '#FFF' : colors.mutedForeground} />
            <Text style={[styles.tabText, tab === 'manual' && styles.tabTextActive]}>
              Manual entry
            </Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={commonStyles.label}>Report type</Text>
          <ChipSelect options={REPORT_TYPES} value={reportType} onChange={setReportType} />
        </View>

        <View>
          <Text style={commonStyles.label}>Report date (YYYY-MM-DD, optional)</Text>
          <TextInput
            value={reportDate}
            onChangeText={setReportDate}
            placeholder="2026-11-04"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>

        {tab === 'upload' ? (
          <View style={{ gap: 12 }}>
            <TouchableOpacity style={styles.fileBtn} onPress={handlePickDocument}>
              <Upload size={18} color={colors.primaryGlow} />
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>
                {pickedFile ? pickedFile.name : 'Choose File (PDF / JPG / PNG)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !pickedFile) && { opacity: 0.55 }]}
              disabled={submitting || !pickedFile}
              onPress={handleUpload}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Upload size={16} color="#FFF" />
              )}
              <Text style={styles.submitText}>Analyze report</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View>
              <Text style={commonStyles.label}>
                Values (one per line, e.g. &quot;Bilirubin: 1.4 mg/dL&quot;)
              </Text>
              <TextInput
                value={manualText}
                onChangeText={setManualText}
                multiline
                numberOfLines={5}
                placeholder={'Bilirubin: 1.4 mg/dL\nALT: 55 U/L\nAST: 48 U/L\nHemoglobin: 13.2 g/dL'}
                placeholderTextColor={colors.mutedForeground}
                style={[commonStyles.input, { minHeight: 110, textAlignVertical: 'top' }]}
              />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !manualText.trim()) && { opacity: 0.55 }]}
              disabled={submitting || !manualText.trim()}
              onPress={handleManual}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <FlaskConical size={16} color="#FFF" />
              )}
              <Text style={styles.submitText}>Analyze values</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={commonStyles.h2}>Your medical reports</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryGlow} />
      ) : reports.length === 0 ? (
        <Text style={commonStyles.subtitle}>No reports yet.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {reports.map((r) => (
            <View key={r.id} style={[commonStyles.card, { gap: 10 }]}>
              <View style={commonStyles.rowBetween}>
                <View>
                  <Text style={commonStyles.h3}>
                    {(r.report_type || 'REPORT').toUpperCase()}{' '}
                    <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>
                      · {(r.report_date || r.created_at).slice(0, 10)}
                    </Text>
                  </Text>
                  <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                    {r.source_type === 'upload' ? r.file_name : 'Manual entry'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(r.id)} style={{ padding: 6 }}>
                  <Trash2 size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>

              {r.summary ? <Text style={commonStyles.subtitle}>{r.summary}</Text> : null}

              {Array.isArray(r.abnormalities) && r.abnormalities.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {r.abnormalities.map((a: any, i: number) => (
                    <View
                      key={i}
                      style={[
                        styles.abnBadge,
                        a.severity === 'severe' && {
                          backgroundColor: colors.destructiveBg,
                          borderColor: colors.destructiveBorder,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: a.severity === 'severe' ? colors.destructive : colors.warning,
                        }}
                      >
                        {a.name}: {a.value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {r.ai_analysis?.comparison_note && (
                <Text style={commonStyles.subtitle}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Trend: </Text>
                  {r.ai_analysis.comparison_note}
                </Text>
              )}

              {r.ai_analysis?.recommendation && (
                <View style={styles.recBox}>
                  <Text style={commonStyles.subtitle}>💡 {r.ai_analysis.recommendation}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.input,
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.mutedSurface,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  submitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  abnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  recBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 10,
    padding: 10,
  },
});
