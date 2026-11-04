import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sun, Moon, Droplets, ShieldAlert, CalendarCheck, AlertTriangle } from 'lucide-react-native';
import { colors, commonStyles } from '../theme';

interface CareRoutineProps {
  severity: string;
  condition: string;
  region: string;
  trend?: string | null;
}

export function getRoutine(severity: string, condition: string, region: string) {
  const sev = severity.toLowerCase();
  const cond = condition.toLowerCase();

  const morning: string[] = [];
  const evening: string[] = [];
  const hydration: string[] = [];
  const triggerAvoidance: string[] = [];
  const followUp: string[] = [];

  // Base routine
  morning.push('Gentle, fragrance-free cleanser');
  morning.push('Broad-spectrum SPF 30+ sunscreen');
  evening.push('Remove makeup/sunscreen with micellar water');
  evening.push('Gentle cleanser');
  hydration.push('Drink at least 8 glasses of water daily');

  if (sev === 'none' || sev === 'normal') {
    morning.push('Lightweight moisturizer');
    evening.push('Night moisturizer');
    hydration.push('Maintain current routine — skin looks healthy');
    followUp.push('Routine check-in scan in 30 days');
  } else if (sev === 'mild') {
    morning.push('Soothing moisturizer with ceramides');
    evening.push('Repair cream or calming night balm');
    hydration.push('Consider foods rich in omega-3 fatty acids');
    triggerAvoidance.push('Avoid harsh exfoliants temporarily');
    triggerAvoidance.push('Limit direct sun exposure');
    followUp.push('Re-scan in 7–14 days to track changes');
  } else if (sev === 'moderate') {
    morning.push('Barrier-repair moisturizer');
    morning.push('Avoid active ingredients (retinol, AHA/BHA) until calmer');
    evening.push('Gentle repair balm or prescribed topical');
    hydration.push('Increase water intake; consider humidifier in dry environments');
    triggerAvoidance.push('Avoid known irritants and new products');
    triggerAvoidance.push('Wear protective clothing in sun');
    followUp.push('Re-scan in 3–7 days');
    followUp.push('Consider consulting a dermatologist if no improvement');
  } else {
    morning.push('Only prescribed or dermatologist-approved products');
    morning.push('Minimal product contact — let skin breathe');
    evening.push("Follow healthcare provider's prescribed routine");
    hydration.push('Stay well-hydrated; avoid alcohol and caffeine');
    triggerAvoidance.push('Avoid all potential irritants immediately');
    triggerAvoidance.push('Do not self-treat — seek professional guidance');
    followUp.push('Re-scan in 3 days to monitor');
    followUp.push('Consult a healthcare professional promptly');
  }

  if (region === 'eye') {
    morning.push('Use gentle eye-safe products only around eyes');
    triggerAvoidance.push('Avoid rubbing eyes');
  }
  if (region === 'palm') {
    morning.push('Apply hand cream after washing');
    triggerAvoidance.push('Use gloves when handling chemicals or harsh soaps');
  }

  if (cond.includes('jaundice')) {
    followUp.push('Monitor sclera (whites of eyes) closely');
    hydration.push('Support liver health — avoid alcohol, eat balanced meals');
  }
  if (cond.includes('burn')) {
    triggerAvoidance.push('Keep the area cool; avoid further heat exposure');
    hydration.push('Apply aloe vera gel to soothe (if not blistered)');
  }

  return { morning, evening, hydration, triggerAvoidance, followUp };
}

export function CareRoutine({ severity, condition, region, trend }: CareRoutineProps) {
  const routine = getRoutine(severity, condition, region);

  const sections = [
    { icon: Sun, title: 'Morning routine', items: routine.morning, color: '#F59E0B' },
    { icon: Moon, title: 'Evening routine', items: routine.evening, color: '#818CF8' },
    { icon: Droplets, title: 'Hydration & nutrition', items: routine.hydration, color: '#0EA5E9' },
    { icon: ShieldAlert, title: 'Trigger avoidance', items: routine.triggerAvoidance, color: '#F43F5E' },
    { icon: CalendarCheck, title: 'Follow-up suggestions', items: routine.followUp, color: colors.primaryGlow },
  ].filter((s) => s.items.length > 0);

  return (
    <View style={commonStyles.card}>
      <View style={[commonStyles.row, { gap: 8, marginBottom: 4 }]}>
        <Sun size={18} color={colors.primaryGlow} />
        <Text style={commonStyles.h2}>Suggested care routine</Text>
      </View>
      <Text style={[commonStyles.subtitle, { fontSize: 12, marginBottom: 14 }]}>
        Personalized guidance based on your severity, region, and condition. This is supportive
        wellness guidance — not a diagnosis or prescription.
      </Text>

      <View style={{ gap: 12 }}>
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <View key={s.title} style={styles.sectionBox}>
              <View style={[commonStyles.row, { gap: 8, marginBottom: 8 }]}>
                <Icon size={16} color={s.color} />
                <Text style={commonStyles.h3}>{s.title}</Text>
              </View>
              {s.items.map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      {trend ? (
        <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: 12 }]}>
          <Text style={{ fontWeight: '700', color: colors.foreground }}>Trend context: </Text>
          {trend}
        </Text>
      ) : null}

      <View style={styles.warningBox}>
        <AlertTriangle size={16} color={colors.warning} style={{ marginTop: 2 }} />
        <Text style={styles.warningText}>
          These suggestions are for general wellness support only. They do not replace professional
          medical advice. Always consult a qualified healthcare provider for diagnosis and treatment.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBox: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 3,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryGlow,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 19,
  },
  warningBox: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
});
