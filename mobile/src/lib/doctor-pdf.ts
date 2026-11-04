import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

interface ScanRow {
  region: string;
  condition: string;
  severity: string;
  confidence: number;
  created_at: string;
  observations?: string | null;
}
interface MedRow {
  report_type?: string | null;
  summary?: string | null;
  report_date?: string | null;
  created_at: string;
}
interface DiaryRow {
  entry_date: string;
  itch?: number;
  pain?: number;
  redness?: number;
}
interface RxRow {
  doctor_name?: string | null;
  prescribed_date?: string | null;
  medicines?: { name?: string; dosage?: string }[];
}
interface InsightRow {
  summary?: string | null;
  observations?: { title: string; detail: string }[];
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function generateAndShareDoctorReport(opts: {
  userEmail: string;
  scans: ScanRow[];
  meds: MedRow[];
  diary: DiaryRow[];
  prescriptions: RxRow[];
  insight: InsightRow | null;
}) {
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 12px; }
        .header { background: #145078; color: #fff; padding: 24px 36px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header h1 { margin: 0 0 6px 0; font-size: 22px; }
        .header p { margin: 0; font-size: 12px; opacity: 0.9; }
        .content { padding: 28px 36px; }
        h2 { color: #145078; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 22px; margin-bottom: 10px; }
        .item { margin-bottom: 10px; }
        .bold { font-weight: bold; }
        .muted { color: #475569; margin-left: 12px; margin-top: 3px; }
        .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 10px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>SkinScope AI — Health Summary</h1>
          <p>Patient: ${escapeHtml(opts.userEmail)}</p>
        </div>
        <p>Generated: ${format(new Date(), 'MMM d, yyyy')}</p>
      </div>
      <div class="content">
        ${
          opts.insight?.summary
            ? `<h2>AI Health Summary</h2>
               <p>${escapeHtml(opts.insight.summary)}</p>
               ${(opts.insight.observations ?? [])
                 .slice(0, 6)
                 .map(
                   (o) =>
                     `<div class="item"><div class="bold">• ${escapeHtml(o.title)}</div><div class="muted">${escapeHtml(o.detail)}</div></div>`,
                 )
                 .join('')}`
            : ''
        }

        ${
          opts.scans.length
            ? `<h2>Visual Scan History</h2>
               ${opts.scans
                 .slice(0, 10)
                 .map(
                   (s) =>
                     `<div class="item">
                        <div class="bold">${format(new Date(s.created_at), 'MMM d, yyyy')} — ${escapeHtml(s.region.toUpperCase())} · ${escapeHtml(s.condition)} (${escapeHtml(s.severity)}, ${Math.round(Number(s.confidence))}%)</div>
                        ${s.observations ? `<div class="muted">${escapeHtml(s.observations)}</div>` : ''}
                      </div>`,
                 )
                 .join('')}`
            : ''
        }

        ${
          opts.meds.length
            ? `<h2>Medical / Lab Reports</h2>
               ${opts.meds
                 .slice(0, 10)
                 .map(
                   (m) =>
                     `<div class="item">
                        <div class="bold">${m.report_date ? format(new Date(m.report_date), 'MMM d, yyyy') : format(new Date(m.created_at), 'MMM d, yyyy')} — ${escapeHtml(m.report_type ?? 'Report')}</div>
                        ${m.summary ? `<div class="muted">${escapeHtml(m.summary)}</div>` : ''}
                      </div>`,
                 )
                 .join('')}`
            : ''
        }

        ${
          opts.prescriptions.length
            ? `<h2>Prescriptions</h2>
               ${opts.prescriptions
                 .slice(0, 10)
                 .map(
                   (p) =>
                     `<div class="item">
                        <div class="bold">${escapeHtml(p.prescribed_date ?? 'Date unknown')} — ${escapeHtml(p.doctor_name ?? 'Doctor')}</div>
                        ${(p.medicines ?? [])
                          .map(
                            (m) =>
                              `<div class="muted">• ${escapeHtml(m.name)}${m.dosage ? ` — ${escapeHtml(m.dosage)}` : ''}</div>`,
                          )
                          .join('')}
                      </div>`,
                 )
                 .join('')}`
            : ''
        }

        ${
          opts.diary.length
            ? `<h2>Recent Symptom Diary</h2>
               ${opts.diary
                 .slice(0, 7)
                 .map(
                   (d) =>
                     `<div class="item">${escapeHtml(d.entry_date)}: itch ${d.itch ?? 0}, pain ${d.pain ?? 0}, redness ${d.redness ?? 0}</div>`,
                 )
                 .join('')}`
            : ''
        }

        <div class="footer">
          AI-assisted insights — not a medical diagnosis. Always consult a licensed healthcare professional.
        </div>
      </div>
    </body>
  </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share SkinScope AI Doctor Report',
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

export async function generateAndShareSingleScanPdf(report: {
  id: string;
  region: string;
  condition: string;
  severity: string;
  confidence: number;
  observations: string | null;
  recommendation: string | null;
  trend: string | null;
  color_features: Record<string, number> | null;
  created_at: string;
}) {
  const cf = report.color_features;
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #141e32; margin: 0; padding: 0; font-size: 12px; }
        .header { background: #2382a5; color: #fff; padding: 28px 36px; }
        .header h1 { margin: 0 0 4px 0; font-size: 24px; }
        .header p { margin: 0; font-size: 11px; opacity: 0.9; }
        .content { padding: 28px 36px; }
        h2 { font-size: 15px; border-bottom: 1px solid #dcdcdc; padding-bottom: 6px; margin-top: 22px; }
        .row { margin: 8px 0; }
        .label { font-weight: bold; display: inline-block; width: 110px; }
        .footer { margin-top: 40px; border-top: 1px solid #dcdcdc; padding-top: 12px; font-size: 10px; color: #646464; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SkinScope AI</h1>
        <p>Wellness assessment report</p>
      </div>
      <div class="content">
        <div class="row"><span class="label">Date:</span> ${format(new Date(report.created_at), 'PPP p')}</div>
        <div class="row"><span class="label">Region:</span> ${escapeHtml(report.region.charAt(0).toUpperCase() + report.region.slice(1))}</div>

        <h2>Assessment</h2>
        <div class="row"><span class="label">Condition:</span> ${escapeHtml(report.condition)}</div>
        <div class="row"><span class="label">Severity:</span> ${escapeHtml(report.severity.charAt(0).toUpperCase() + report.severity.slice(1))}</div>
        <div class="row"><span class="label">Confidence:</span> ${Math.round(Number(report.confidence))}%</div>
        <div class="row"><span class="label">Trend:</span> ${escapeHtml(report.trend || '—')}</div>

        <h2>Observations</h2>
        <p>${escapeHtml(report.observations || '—')}</p>

        <h2>Recommendation</h2>
        <p>${escapeHtml(report.recommendation || '—')}</p>

        ${
          cf
            ? `<h2>Color analysis</h2>
               <div class="row">Yellow ratio: ${cf.yellowRatio ?? 0}%</div>
               <div class="row">Red ratio: ${cf.redRatio ?? 0}%</div>
               <div class="row">Dark ratio: ${cf.darkRatio ?? 0}%</div>
               <div class="row">Brightness: ${cf.brightness ?? 0}/100</div>
               <div class="row">Avg RGB: (${cf.avgR ?? 0}, ${cf.avgG ?? 0}, ${cf.avgB ?? 0})</div>`
            : ''
        }

        <div class="footer">
          SkinScope AI is an educational wellness tool, not a medical device. Always consult a qualified healthcare professional for any concerning symptoms.
        </div>
      </div>
    </body>
  </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `SkinScope-Report-${report.id.slice(0, 8)}.pdf`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}
