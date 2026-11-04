import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { format } from 'date-fns';
import { Pill, Upload, Camera, FileText } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface Medicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  purpose?: string;
  precautions?: string;
  side_effects?: string;
}

interface RxRow {
  id: string;
  doctor_name: string | null;
  prescribed_date: string | null;
  ai_explanation: string | null;
  raw_text: string | null;
  medicines: Medicine[];
  created_at: string;
}

export default function PrescriptionsScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RxRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({});

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRows((data ?? []) as unknown as RxRow[]);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const processAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user || !asset.base64) return;
    setAnalyzing(true);
    try {
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `rx-${Date.now()}.jpg`;
      const path = `${user.id}/${Date.now()}-${fileName}`;
      const arrayBuffer = decodeBase64(asset.base64);
      const { error: upErr } = await supabase.storage
        .from('prescriptions')
        .upload(path, arrayBuffer, { contentType: mimeType });
      if (upErr) throw upErr;

      const dataUrl = `data:${mimeType};base64,${asset.base64}`;
      const { data, error } = await supabase.functions.invoke('analyze-prescription', {
        body: { imageBase64: dataUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { error: insErr } = await supabase.from('prescriptions').insert({
        user_id: user.id,
        file_path: path,
        file_name: fileName,
        mime_type: mimeType,
        raw_text: data.raw_text,
        medicines: data.medicines ?? [],
        ai_explanation: data.ai_explanation,
        doctor_name: data.doctor_name ?? null,
        prescribed_date: data.prescribed_date || null,
      });
      if (insErr) throw insErr;
      toast.success('Prescription analyzed');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const pickPrescription = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permission denied.');
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
        });
    if (!res.canceled && res.assets?.[0]) {
      await processAsset(res.assets[0]);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <Pill size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Prescriptions</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Upload a doctor&apos;s prescription or medicine strip. JARVIS will read it and explain
          each medicine.
        </Text>
      </View>

      <DisclaimerBanner text="AI-assisted reading only. Always verify dosage and medicines with your prescribing doctor or pharmacist." />

      <View style={[commonStyles.card, { gap: 10 }]}>
        <Text style={commonStyles.h2}>Upload prescription</Text>
        <Text style={commonStyles.subtitle}>JPG / PNG of handwritten or printed prescription</Text>
        <View style={[commonStyles.row, { gap: 10, marginTop: 4 }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, analyzing && { opacity: 0.6 }]}
            disabled={analyzing}
            onPress={() => pickPrescription(false)}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Upload size={16} color="#FFF" />
            )}
            <Text style={styles.primaryBtnText}>
              {analyzing ? 'Analyzing…' : 'Upload image'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineBtn, analyzing && { opacity: 0.6 }]}
            disabled={analyzing}
            onPress={() => pickPrescription(true)}
          >
            <Camera size={16} color={colors.foreground} />
            <Text style={styles.outlineBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {rows.length === 0 ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.h3}>No prescriptions yet</Text>
            <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
              Upload one to get started.
            </Text>
          </View>
        ) : (
          rows.map((r) => (
            <View key={r.id} style={[commonStyles.card, { gap: 12 }]}>
              <View style={[commonStyles.row, { gap: 8 }]}>
                <FileText size={16} color={colors.primaryGlow} />
                <Text style={commonStyles.h3}>{r.doctor_name || 'Prescription'}</Text>
                <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                  · {format(new Date(r.created_at), 'MMM d, yyyy')}
                </Text>
              </View>

              {r.medicines?.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={commonStyles.h3}>Medicines</Text>
                  {r.medicines.map((m, i) => (
                    <View key={i} style={styles.medBox}>
                      <View style={[commonStyles.row, { gap: 8, flexWrap: 'wrap' }]}>
                        <View style={styles.medPill}>
                          <Text style={styles.medPillText}>{m.name}</Text>
                        </View>
                        {m.dosage ? (
                          <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>{m.dosage}</Text>
                        ) : null}
                      </View>
                      {m.frequency && (
                        <Text style={styles.medLine}>
                          <Text style={styles.medStrong}>When: </Text>
                          {m.frequency}
                        </Text>
                      )}
                      {m.duration && (
                        <Text style={styles.medLine}>
                          <Text style={styles.medStrong}>Duration: </Text>
                          {m.duration}
                        </Text>
                      )}
                      {m.purpose && (
                        <Text style={styles.medLine}>
                          <Text style={styles.medStrong}>Purpose: </Text>
                          {m.purpose}
                        </Text>
                      )}
                      {m.precautions && (
                        <Text style={styles.medLine}>
                          <Text style={styles.medStrong}>Precautions: </Text>
                          {m.precautions}
                        </Text>
                      )}
                      {m.side_effects && (
                        <Text style={styles.medLine}>
                          <Text style={styles.medStrong}>Common side effects: </Text>
                          {m.side_effects}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {r.ai_explanation && (
                <View style={styles.aiBox}>
                  <Text style={{ color: colors.primaryGlow, fontSize: 12, fontWeight: '700' }}>
                    AI explanation
                  </Text>
                  <Text style={[commonStyles.subtitle, { color: colors.foreground, marginTop: 4 }]}>
                    {r.ai_explanation}
                  </Text>
                </View>
              )}

              {r.raw_text && (
                <View>
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedRaw((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                    }
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {expandedRaw[r.id] ? 'Hide extracted raw text' : 'Show extracted raw text'}
                    </Text>
                  </TouchableOpacity>
                  {expandedRaw[r.id] && (
                    <Text style={styles.rawPre}>{r.raw_text}</Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '700',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.input,
  },
  outlineBtnText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  medBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  medPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  medPillText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  medLine: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  medStrong: {
    color: colors.foreground,
    fontWeight: '600',
  },
  aiBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rawPre: {
    marginTop: 6,
    backgroundColor: colors.backgroundSubtle,
    padding: 10,
    borderRadius: 8,
    color: colors.mutedForeground,
    fontSize: 11,
  },
});
