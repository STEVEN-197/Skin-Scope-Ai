import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import {
  Upload,
  Eye,
  Hand,
  Sparkles,
  X,
  ArrowRight,
  Camera,
} from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { analyzeImageBase64, applyRegionRules } from '../../src/lib/color-analysis';
import { toast } from '../../src/lib/toast';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

type Region = 'eye' | 'skin' | 'palm';

const REGIONS: { id: Region; label: string; Icon: any; hint: string }[] = [
  { id: 'eye', label: 'Eye', Icon: Eye, hint: 'Sclera (white of the eye)' },
  { id: 'skin', label: 'Skin', Icon: Sparkles, hint: 'Face, arm, or affected area' },
  { id: 'palm', label: 'Palm', Icon: Hand, hint: 'Inside of the hand' },
];

interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
  ext: string;
}

export default function AnalyzeScreen() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [region, setRegion] = useState<Region>('skin');
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState('');

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Photo library permission is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
    setPicked({
      uri: asset.uri,
      base64: asset.base64 ?? '',
      mimeType: mime,
      ext,
    });
  };

  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.error('Camera permission denied. Please allow camera access.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
    setPicked({
      uri: asset.uri,
      base64: asset.base64 ?? '',
      mimeType: mime,
      ext,
    });
  };

  const runAnalysis = async () => {
    if (!picked || !user || !session) return;
    setAnalyzing(true);
    try {
      const dataUrl = `data:${picked.mimeType};base64,${picked.base64}`;

      // 1. Validate image actually shows the requested region
      setStage('Validating image…');
      const { data: vData } = await supabase.functions.invoke('validate-image', {
        body: { imageBase64: dataUrl, region },
      });
      if (vData && vData.valid === false) {
        toast.error(`This doesn't look like a ${region} image. ${vData.reason || ''}`);
        setAnalyzing(false);
        setStage('');
        return;
      }

      // 2. Color analysis (on-device)
      setStage('Extracting color features…');
      const colorFeatures = await analyzeImageBase64(picked.base64);
      const ruleResult = applyRegionRules(region, colorFeatures);

      // 3. Upload image to private storage
      setStage('Uploading image securely…');
      const fileId = `${Date.now()}-${Date.now().toString(36)}`;
      const path = `${user.id}/${fileId}.${picked.ext}`;
      const arrayBuffer = decodeBase64(picked.base64);
      const { error: upErr } = await supabase.storage
        .from('skin-images')
        .upload(path, arrayBuffer, { contentType: picked.mimeType });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      // 4. Call edge function
      setStage('Running AI vision analysis…');
      const { data: aiData, error: fnErr } = await supabase.functions.invoke('analyze-skin', {
        body: { imageBase64: dataUrl, region, colorFeatures, ruleResult },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (aiData?.error) throw new Error(aiData.error);

      // 5. Persist
      setStage('Saving report…');
      const { data: inserted, error: insErr } = await supabase
        .from('reports')
        .insert([
          {
            user_id: user.id,
            image_path: path,
            region,
            condition: aiData.condition,
            severity: aiData.severity,
            confidence: aiData.confidence,
            observations: aiData.observations,
            recommendation: aiData.recommendation,
            trend: aiData.trend_note ? `${aiData.trend}: ${aiData.trend_note}` : aiData.trend,
            color_features: colorFeatures as any,
            ai_raw: aiData as any,
          },
        ])
        .select('id')
        .single();
      if (insErr) throw new Error(insErr.message);

      toast.success('Analysis complete!');
      router.push(`/dashboard/reports/${inserted.id}` as any);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
      setStage('');
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
          New analysis
        </Text>
        <Text style={[commonStyles.h1, { marginTop: 4 }]}>Upload an image to analyze</Text>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Choose the body region, upload or snap a clear photo in good lighting, and get an
          AI-powered wellness report.
        </Text>
      </View>

      <View style={[commonStyles.card, { gap: 18 }]}>
        {/* Region Selector */}
        <View>
          <Text style={commonStyles.label}>Region</Text>
          <View style={styles.regionRow}>
            {REGIONS.map((r) => {
              const active = region === r.id;
              const Icon = r.Icon;
              return (
                <TouchableOpacity
                  key={r.id}
                  disabled={analyzing}
                  onPress={() => setRegion(r.id)}
                  style={[styles.regionCard, active && styles.regionCardActive]}
                >
                  <View style={[styles.regionIcon, active && styles.regionIconActive]}>
                    <Icon size={18} color={active ? '#FFF' : colors.mutedForeground} />
                  </View>
                  <Text style={commonStyles.h3}>{r.label}</Text>
                  <Text style={[commonStyles.subtitle, { fontSize: 10, textAlign: 'center' }]}>
                    {r.hint}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Image Picker / Camera */}
        <View>
          <Text style={commonStyles.label}>Image</Text>
          {picked ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: picked.uri }} style={styles.previewImg} resizeMode="contain" />
              <TouchableOpacity
                style={styles.removeBtn}
                disabled={analyzing}
                onPress={() => setPicked(null)}
              >
                <X size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={styles.uploadBox}
                disabled={analyzing}
                onPress={pickFromLibrary}
              >
                <Upload size={26} color={colors.primaryGlow} />
                <Text style={[commonStyles.h3, { marginTop: 6 }]}>Tap to upload from gallery</Text>
                <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                  PNG, JPG, or HEIC · Max 8 MB
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraBtn}
                disabled={analyzing}
                onPress={captureFromCamera}
              >
                <Camera size={18} color={colors.foreground} />
                <Text style={styles.cameraBtnText}>Take Photo with Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.runBtn, (!picked || analyzing) && { opacity: 0.55 }]}
          disabled={!picked || analyzing}
          onPress={runAnalysis}
        >
          {analyzing ? (
            <View style={[commonStyles.row, { gap: 8 }]}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.runBtnText}>{stage || 'Analyzing…'}</Text>
            </View>
          ) : (
            <View style={[commonStyles.row, { gap: 8 }]}>
              <Text style={styles.runBtnText}>Run analysis</Text>
              <ArrowRight size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* How it works */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.h2}>How it works</Text>
        <View style={{ gap: 10, marginTop: 12 }}>
          {[
            'We extract RGB & HSV features from your image right on your device.',
            'A vision model reviews the image with region-specific thresholds.',
            'Your past reports inform the trend (improving · stable · worsening).',
          ].map((step, i) => (
            <View key={i} style={[commonStyles.row, { gap: 10, alignItems: 'flex-start' }]}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{i + 1}</Text>
              </View>
              <Text style={[commonStyles.subtitle, { flex: 1 }]}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <DisclaimerBanner text="Educational use only: SkinScope AI does not diagnose medical conditions. Always consult a healthcare professional for any concerning findings." />

      <View style={commonStyles.card}>
        <Text style={commonStyles.h3}>Tips for best results</Text>
        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={commonStyles.subtitle}>• Use natural daylight, avoid yellow lamps</Text>
          <Text style={commonStyles.subtitle}>• Keep the camera 15–25 cm from the area</Text>
          <Text style={commonStyles.subtitle}>• Make sure the area fills most of the frame</Text>
          <Text style={commonStyles.subtitle}>• Clean lens, steady hand, neutral background</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  regionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  regionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  regionCardActive: {
    borderColor: colors.primaryGlow,
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
  },
  regionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionIconActive: {
    backgroundColor: colors.primary,
  },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.mutedSurface,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.input,
  },
  cameraBtnText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewImg: {
    width: '100%',
    height: 280,
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: colors.primaryGlow,
    fontSize: 12,
    fontWeight: '700',
  },
});
