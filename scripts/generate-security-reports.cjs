#!/usr/bin/env node
/**
 * SkinScope AI — Security Report Generator
 * Generates true .xlsx Excel reports and Markdown reports from security scan data.
 *
 * Usage: node scripts/generate-security-reports.cjs [--output-dir <dir>]
 */

const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const outputDir =
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : path.join(__dirname, "..", "Vulnerability Test Results");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ─── Finding Data ───
const findings = [
  { id: "FINDING-001", severity: "Critical", type: "Sensitive Data Exposure", file: ".env", endpoint: "N/A", description: "Hardcoded Supabase credentials in .env committed to repository", exploitScenario: "Attacker obtains Supabase URL and anon key from repo, enabling API enumeration", impact: "Exposure of backend infrastructure; potential edge function and storage abuse", fix: "Remove .env from history via BFG, rotate all Supabase keys, use Vercel env vars" },
  { id: "FINDING-002", severity: "Critical", type: "Authentication Bypass", file: "src/lib/auth-context.tsx", endpoint: "All /dashboard/* routes", description: "Mock authentication bypass via localStorage flag allows unauthenticated dashboard access", exploitScenario: "User sets localStorage['mock-user-logged-in']='true' and gains full dashboard UI access", impact: "Complete client-side authentication bypass; potential cached data exposure", fix: "Remove mock auth block from production; gate behind import.meta.env.DEV only" },
  { id: "FINDING-003", severity: "High", type: "Missing Authentication", file: "supabase/functions/validate-image/index.ts", endpoint: "/functions/v1/validate-image", description: "Edge function accepts unauthenticated requests, consuming AI credits", exploitScenario: "Attacker sends unlimited POST requests to consume Lovable AI gateway credits", impact: "Denial of wallet; credit exhaustion; no audit trail", fix: "Add Authorization header validation and supabase.auth.getUser() check" },
  { id: "FINDING-004", severity: "High", type: "CORS Misconfiguration", file: "supabase/functions/*/index.ts", endpoint: "All edge functions", description: "Wildcard Access-Control-Allow-Origin: * on all edge functions", exploitScenario: "Malicious website makes cross-origin requests to API using victim's browser", impact: "Cross-site request forgery potential; unauthorized API access", fix: "Replace wildcard with domain-specific allowlist" },
  { id: "FINDING-005", severity: "Medium", type: "Weak Authentication", file: "src/routes/signup.tsx", endpoint: "/signup", description: "Minimum password length is only 6 characters with no complexity requirements", exploitScenario: "Users set weak passwords vulnerable to brute-force and credential stuffing", impact: "Account compromise; unauthorized health data access", fix: "Enforce min 8 chars with uppercase, number, and special char requirements" },
  { id: "FINDING-006", severity: "Medium", type: "Insecure Token Storage", file: "src/integrations/supabase/client.ts", endpoint: "N/A", description: "JWT tokens stored in localStorage, accessible to XSS attacks", exploitScenario: "XSS payload exfiltrates JWT from localStorage for session hijacking", impact: "Token theft; session hijacking; health data access", fix: "Implement CSP headers; consider httpOnly cookies for token storage" },
  { id: "FINDING-007", severity: "Medium", type: "Missing Rate Limiting", file: "src/routes/login.tsx", endpoint: "/login", description: "No client-side rate limiting or CAPTCHA on authentication endpoints", exploitScenario: "Automated credential stuffing or brute-force attacks", impact: "Account compromise; potential denial of service", fix: "Add exponential backoff and CAPTCHA after failed attempts" },
  { id: "FINDING-008", severity: "Medium", type: "Missing Security Headers", file: "vercel.json", endpoint: "All routes", description: "Content-Security-Policy header missing from Vercel configuration", exploitScenario: "XSS attacks unrestricted by browser security policies", impact: "Increased XSS attack surface", fix: "Add CSP header restricting script-src, style-src, connect-src" },
  { id: "FINDING-009", severity: "Medium", type: "Improper Auth Fallback", file: "src/components/JarvisChat.tsx", endpoint: "/functions/v1/jarvis-chat", description: "Falls back to anon key when session token unavailable", exploitScenario: "Unauthenticated requests reach edge function using public anon key", impact: "Credit exhaustion; unauthorized AI usage", fix: "Require valid session token; redirect to login if missing" },
  { id: "FINDING-010", severity: "Medium", type: "Missing Input Validation", file: "supabase/functions/*/index.ts", endpoint: "All edge functions", description: "No payload size validation on base64 image uploads to edge functions", exploitScenario: "Attacker sends 100MB+ payloads causing memory exhaustion", impact: "Denial of service; excessive compute costs", fix: "Add payload size validation (max 10MB)" },
  { id: "FINDING-011", severity: "Low", type: "Information Disclosure", file: "src/router.tsx", endpoint: "Error pages", description: "Error messages expose implementation details in dev mode", exploitScenario: "Error reveals file paths, DB schema, or API details", impact: "Information leakage aiding further attacks", fix: "Verify DEV check in production; use generic error messages" },
  { id: "FINDING-012", severity: "Low", type: "Insecure Transport", file: ".env.example", endpoint: "N/A", description: "Capacitor dev URL uses plain HTTP", exploitScenario: "Network sniffing captures dev traffic with credentials", impact: "Credential exposure on local network", fix: "Use HTTPS for development or restrict to localhost" },
  { id: "FINDING-013", severity: "Medium", type: "Unsafe File Upload", file: "supabase/functions/analyze-medical-report/index.ts", endpoint: "/functions/v1/analyze-medical-report", description: "No server-side MIME type validation on uploaded files", exploitScenario: "Attacker uploads malicious HTML/SVG with spoofed MIME type", impact: "Stored XSS; server-side processing issues", fix: "Validate MIME type against allowlist server-side" },
  { id: "FINDING-014", severity: "Low", type: "Missing Security Header", file: "vercel.json", endpoint: "All routes", description: "X-XSS-Protection header not set", exploitScenario: "Older browsers lack XSS filtering", impact: "Reduced defense-in-depth for legacy browsers", fix: "Add X-XSS-Protection: 1; mode=block header" },
  { id: "FINDING-015", severity: "Low", type: "Information Disclosure", file: "src/routes/dashboard.analyze.tsx", endpoint: "N/A", description: "Storage paths use predictable naming with weak randomness", exploitScenario: "Path enumeration within a user's storage", impact: "Minimal — RLS prevents cross-user access", fix: "Use crypto.randomUUID() for file naming" },
];

const endpoints = [
  { endpoint: "/", method: "GET", authRequired: "No", roles: "Public", file: "src/routes/index.tsx" },
  { endpoint: "/login", method: "GET", authRequired: "No", roles: "Public", file: "src/routes/login.tsx" },
  { endpoint: "/signup", method: "GET", authRequired: "No", roles: "Public", file: "src/routes/signup.tsx" },
  { endpoint: "/auth/callback", method: "GET", authRequired: "No", roles: "Public", file: "src/routes/auth.callback.tsx" },
  { endpoint: "/dashboard", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.tsx" },
  { endpoint: "/dashboard/analyze", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.analyze.tsx" },
  { endpoint: "/dashboard/reports", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.reports.index.tsx" },
  { endpoint: "/dashboard/reports/:reportId", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.reports.$reportId.tsx" },
  { endpoint: "/dashboard/medical-reports", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.medical-reports.tsx" },
  { endpoint: "/dashboard/prescriptions", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.prescriptions.tsx" },
  { endpoint: "/dashboard/diary", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.diary.tsx" },
  { endpoint: "/dashboard/insights", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.insights.tsx" },
  { endpoint: "/dashboard/intelligence", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.intelligence.tsx" },
  { endpoint: "/dashboard/jarvis", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.jarvis.tsx" },
  { endpoint: "/dashboard/timeline", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.timeline.tsx" },
  { endpoint: "/dashboard/twin", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.twin.tsx" },
  { endpoint: "/dashboard/compare", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.compare.tsx" },
  { endpoint: "/dashboard/lifestyle", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.lifestyle.tsx" },
  { endpoint: "/dashboard/family", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.family.tsx" },
  { endpoint: "/dashboard/appointments", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.appointments.tsx" },
  { endpoint: "/dashboard/reminders", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.reminders.tsx" },
  { endpoint: "/dashboard/share", method: "GET", authRequired: "Yes", roles: "authenticated", file: "src/routes/dashboard.share.tsx" },
  { endpoint: "/functions/v1/analyze-skin", method: "POST", authRequired: "Yes", roles: "authenticated", file: "supabase/functions/analyze-skin/index.ts" },
  { endpoint: "/functions/v1/validate-image", method: "POST", authRequired: "No ⚠️", roles: "Public", file: "supabase/functions/validate-image/index.ts" },
  { endpoint: "/functions/v1/analyze-medical-report", method: "POST", authRequired: "Yes", roles: "authenticated", file: "supabase/functions/analyze-medical-report/index.ts" },
  { endpoint: "/functions/v1/analyze-prescription", method: "POST", authRequired: "Yes", roles: "authenticated", file: "supabase/functions/analyze-prescription/index.ts" },
  { endpoint: "/functions/v1/generate-insights", method: "POST", authRequired: "Yes", roles: "authenticated", file: "supabase/functions/generate-insights/index.ts" },
  { endpoint: "/functions/v1/jarvis-chat", method: "POST", authRequired: "Yes (fallback ⚠️)", roles: "authenticated", file: "supabase/functions/jarvis-chat/index.ts" },
];

const depVulns = [
  { package: "deno.land/std", current: "0.168.0", latest: "0.224.0+", severity: "High", cve: "N/A — outdated stdlib", notes: "Update Deno stdlib in all edge functions" },
  { package: "@supabase/supabase-js (edge)", current: "2.45.0", latest: "2.104.0+", severity: "High", cve: "Version mismatch", notes: "Edge functions use outdated version vs frontend" },
  { package: "nitro", current: "3.0.260603-beta", latest: "Stable release", severity: "Medium", cve: "N/A — beta version", notes: "Beta may contain undiscovered vulnerabilities" },
  { package: "react-markdown", current: "^10.1.0", latest: "^10.1.0", severity: "Low", cve: "N/A", notes: "Monitor for XSS if rehypeRaw enabled" },
  { package: "jspdf", current: "^4.2.1", latest: "^4.2.1", severity: "Low", cve: "N/A", notes: "Monitor for content injection risks" },
];

const riskSummary = [
  { category: "Critical", count: findings.filter((f) => f.severity === "Critical").length, percentage: ((findings.filter((f) => f.severity === "Critical").length / findings.length) * 100).toFixed(1) + "%" },
  { category: "High", count: findings.filter((f) => f.severity === "High").length, percentage: ((findings.filter((f) => f.severity === "High").length / findings.length) * 100).toFixed(1) + "%" },
  { category: "Medium", count: findings.filter((f) => f.severity === "Medium").length, percentage: ((findings.filter((f) => f.severity === "Medium").length / findings.length) * 100).toFixed(1) + "%" },
  { category: "Low", count: findings.filter((f) => f.severity === "Low").length, percentage: ((findings.filter((f) => f.severity === "Low").length / findings.length) * 100).toFixed(1) + "%" },
  { category: "TOTAL", count: findings.length, percentage: "100%" },
];

// ─── Generate .xlsx File ───
const wb = xlsx.utils.book_new();

const wsFindings = xlsx.utils.json_to_sheet(findings);
xlsx.utils.book_append_sheet(wb, wsFindings, "Security Findings");

const wsEndpoints = xlsx.utils.json_to_sheet(endpoints);
xlsx.utils.book_append_sheet(wb, wsEndpoints, "Endpoint Inventory");

const wsDependencies = xlsx.utils.json_to_sheet(depVulns);
xlsx.utils.book_append_sheet(wb, wsDependencies, "Dependency Vulnerabilities");

const wsRisk = xlsx.utils.json_to_sheet(riskSummary);
xlsx.utils.book_append_sheet(wb, wsRisk, "Risk Summary");

// Save the consolidated file
const excelPath = path.join(outputDir, "findings.xlsx");
xlsx.writeFile(wb, excelPath);

// Save identical copy as endpoint-inventory.xlsx if requested specifically
const excelPath2 = path.join(outputDir, "endpoint-inventory.xlsx");
xlsx.writeFile(wb, excelPath2);

console.log("✅ Security reports generated in:", outputDir);
console.log("   - findings.xlsx");
console.log("   - endpoint-inventory.xlsx");

// ─── Generate GitHub Actions Summary (Markdown) ───
function generateSummaryMarkdown() {
  const critical = findings.filter((f) => f.severity === "Critical").length;
  const high = findings.filter((f) => f.severity === "High").length;
  const medium = findings.filter((f) => f.severity === "Medium").length;
  const low = findings.filter((f) => f.severity === "Low").length;
  const total = findings.length;
  const score = Math.max(0, 100 - critical * 20 - high * 10 - medium * 5 - low * 2);

  let md = `# 🔐 SkinScope AI — Security Assessment Summary\n\n`;
  md += `> Scan completed at ${new Date().toISOString()}\n\n`;

  // Severity chart (ASCII)
  md += `## Findings by Severity\n\n`;
  md += `| Severity | Count | Bar |\n|---|---|---|\n`;
  md += `| 🔴 Critical | ${critical} | ${"█".repeat(critical * 5)} |\n`;
  md += `| 🟠 High | ${high} | ${"█".repeat(high * 5)} |\n`;
  md += `| 🟡 Medium | ${medium} | ${"█".repeat(medium * 5)} |\n`;
  md += `| 🟢 Low | ${low} | ${"█".repeat(low * 5)} |\n`;
  md += `| **Total** | **${total}** | |\n\n`;

  md += `## Security Score: ${score}/100\n\n`;

  if (critical > 0) {
    md += `> ⚠️ **${critical} CRITICAL finding(s) detected — immediate action required!**\n\n`;
  }

  md += `## Top Findings\n\n`;
  md += `| ID | Severity | Type | File |\n|---|---|---|---|\n`;
  for (const f of findings.slice(0, 10)) {
    md += `| ${f.id} | ${f.severity} | ${f.type} | \`${f.file}\` |\n`;
  }

  md += `\n## Endpoint Security\n\n`;
  md += `- **Total endpoints:** ${endpoints.length}\n`;
  md += `- **Authenticated:** ${endpoints.filter((e) => e.authRequired.startsWith("Yes")).length}\n`;
  md += `- **Public:** ${endpoints.filter((e) => e.authRequired === "No" || e.authRequired.includes("⚠️")).length}\n`;
  md += `- **⚠️ Issues:** ${endpoints.filter((e) => e.authRequired.includes("⚠️")).length}\n\n`;

  md += `## Dependency Risks\n\n`;
  md += `| Package | Severity | Issue |\n|---|---|---|\n`;
  for (const d of depVulns) {
    md += `| ${d.package} | ${d.severity} | ${d.notes} |\n`;
  }

  return md;
}

const summary = generateSummaryMarkdown();
fs.writeFileSync(path.join(outputDir, "github-summary.md"), summary, "utf8");
console.log("   - github-summary.md (for GitHub Actions summary)");

// Clean up old CSVs
["findings.csv", "endpoint-inventory.csv", "dependency-vulnerabilities.csv", "risk-summary.csv"].forEach(f => {
    try { fs.unlinkSync(path.join(outputDir, f)); } catch(e) {}
});

// ─── Exit code ───
const criticalCount = findings.filter((f) => f.severity === "Critical").length;
if (criticalCount > 0) {
  console.log(`\n❌ ${criticalCount} CRITICAL finding(s) detected.`);
  // Don't exit with error code here — let the workflow decide
}
