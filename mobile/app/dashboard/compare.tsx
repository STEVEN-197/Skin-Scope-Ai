import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { GitCompareArrows } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { SeverityBadge } from '../../src/components/SeverityBadge';
import { ChipSelect, DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface R {
  id: string;
  region: string;
  condition: string;
  severity: string;
  created_at: string;
  image_path: string;
  color_features: any;
}

const SEV: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 };

const REGION_OPTS = [
  { label: 'Skin', value: 'skin' },
  { label: 'Eye', value: 'eye' },
  { label: 'Palm', value: 'palm' },
];

export default function CompareScreen() {
  const { user } = useAuth();
  const [a, setA] = useState<R | null>(null);
  const [b, setB] = useState<R | null>(null);
  const [aUrl, setAUrl] = useState<string | null>(null);
  const [bUrl, setBUrl] = useState<string | null>(null);
  const [region, setRegion] = useState<string>('skin');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('reports')
        .select('id,region,condition,severity,created_at,image_path,color_features')
        .eq('user_id', user.id)
        .eq('region', region)
        .order('created_at', { ascending: false })
        .limit(2);
      const arr = (data ?? []) as R[];
      const cur = arr[0] ?? null;
      const prev = arr[1] ?? null;
      setB(cur);
      setA(prev);
      setAUrl(
        prev
          ? (await supabase.storage.from('skin-images').createSignedUrl(prev.image_path, 600)).data
              ?.signedUrl ?? null
          : null,
      );
      setBUrl(
        cur
          ? (await supabase.storage.from('skin-images').createSignedUrl(cur.image_path, 600)).data
              ?.signedUrl ?? null
          : null,
      );
    })();
  }, [user?.id, region]);

  const diff = (k: string) => {
    if (!a || !b || !a.color_features || !b.color_features) return null;
    const av = Number(a.color_features[k] ?? 0);
    const bv = Number(b.color_features[k] ?? 0);
    return { av, bv, delta: bv - av };
  };

  const yellow = diff('yellowRatio');
  const red = diff('redRatio');
  const dark = diff('darkRatio');
  const bright = diff('brightness');
  const sevDelta = a && b ? (SEV[b.severity] ?? 0) - (SEV[a.severity] ?? 0) : 0;

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View style={{ gap: 10 }}>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <GitCompareArrows size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>What Changed?</Text>
        </View>
        <Text style={commonStyles.subtitle}>
          Side-by-side AI comparison between your two most recent scans.
        </Text>
        <ChipSelect options={REGION_OPTS} value={region} onChange={setRegion} />
      </View>

      <DisclaimerBanner text="Visual delta is AI-assisted and may be affected by lighting and camera differences." />

      {!a || !b ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>
            Need at least 2 {region} scans to compare. Run another analysis.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.grid2}>
            <ScanCompareCard label="Previous" report={a} url={aUrl} />
            <ScanCompareCard label="Current" report={b} url={bUrl} />
          </View>

          <View style={[commonStyles.card, { gap: 10 }]}>
            <Text style={commonStyles.h2}>Visual deltas</Text>
            <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: -6 }]}>
              From {format(new Date(a.created_at), 'MMM d')} to{' '}
              {format(new Date(b.created_at), 'MMM d')}
            </Text>
            <DeltaRow label="Yellowing" delta={yellow?.delta} suffix="%" goodWhenNegative />
            <DeltaRow label="Redness" delta={red?.delta} suffix="%" goodWhenNegative />
            <DeltaRow label="Darkness" delta={dark?.delta} suffix="%" goodWhenNegative />
            <DeltaRow
              label="Brightness"
              delta={bright?.delta}
              suffix=""
              goodWhenNegative={false}
            />
            <DeltaRow
              label="Severity score"
              delta={sevDelta}
              suffix=""
              goodWhenNegative
              integer
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ScanCompareCard({
  label,
  report,
  url,
}: {
  label: string;
  report: R;
  url: string | null;
}) {
  return (
    <View style={[commonStyles.card, { flex: 1, minWidth: '47%', gap: 8 }]}>
      <Text style={[commonStyles.subtitle, { fontSize: 11 }]}>
        {label} · {format(new Date(report.created_at), 'MMM d, yyyy')}
      </Text>
      <Text style={commonStyles.h3} numberOfLines={1}>
        {report.condition}
      </Text>
      {url ? (
        <Image source={{ uri: url }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={[styles.img, { backgroundColor: colors.secondary }]} />
      )}
      <View style={{ alignSelf: 'flex-start' }}>
        <SeverityBadge severity={report.severity} />
      </View>
    </View>
  );
}

function DeltaRow({
  label,
  delta,
  suffix,
  goodWhenNegative,
  integer,
}: {
  label: string;
  delta: number | undefined | null;
  suffix: string;
  goodWhenNegative: boolean;
  integer?: boolean;
}) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
  const better = goodWhenNegative ? delta < 0 : delta > 0;
  const sign = delta > 0 ? '+' : '';
  return (
    <View style={styles.deltaBox}>
      <View style={commonStyles.rowBetween}>
        <Text style={commonStyles.h3}>{label}</Text>
        <View
          style={[
            styles.deltaBadge,
            delta === 0
              ? { backgroundColor: colors.secondary }
              : better
                ? { backgroundColor: colors.successBg }
                : { backgroundColor: colors.destructiveBg },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color:
                delta === 0
                  ? colors.foreground
                  : better
                    ? colors.success
                    : colors.destructive,
            }}
          >
            {sign}
            {integer ? delta : delta.toFixed(1)}
            {suffix}
          </Text>
        </View>
      </View>
      <Text style={[commonStyles.subtitle, { fontSize: 11, marginTop: 2 }]}>
        {delta === 0 ? 'No change' : better ? 'Improved' : 'Increased'}
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
  img: {
    width: '100%',
    height: 140,
    borderRadius: 10,
  },
  deltaBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  deltaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
