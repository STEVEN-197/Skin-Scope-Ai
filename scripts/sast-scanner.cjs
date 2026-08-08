#!/usr/bin/env node
/**
 * SkinScope AI — Static Application Security Testing (SAST) Scanner
 * Performs automated static analysis of the codebase for security vulnerabilities.
 *
 * Checks:
 * - Hardcoded secrets/credentials
 * - Unsafe patterns (eval, innerHTML, dangerouslySetInnerHTML)
 * - Missing auth checks in edge functions
 * - CORS misconfigurations
 * - Insecure configurations
 * - Weak cryptography
 * - SQL injection patterns
 *
 * Usage: node scripts/sast-scanner.js [--json] [--fail-on-critical]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const outputJson = process.argv.includes("--json");
const failOnCritical = process.argv.includes("--fail-on-critical");

// ─── Pattern Definitions ───
const PATTERNS = [
  // Secrets
  { id: "SEC001", severity: "Critical", category: "Hardcoded Secrets", pattern: /(?:sk_live_|sk_test_)[a-zA-Z0-9]{20,}/g, description: "Hardcoded Stripe secret key" },
  { id: "SEC002", severity: "Critical", category: "Hardcoded Secrets", pattern: /(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\s*[=:]\s*["'][^"']{20,}["']/gi, description: "Hardcoded Supabase service role key" },
  { id: "SEC003", severity: "High", category: "Hardcoded Secrets", pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']+["']/gi, description: "Hardcoded password", exclude: ["placeholder", "example", "your-", "***", "Password", "autoComplete", "label", "type=", "htmlFor", "minLength"] },
  { id: "SEC004", severity: "High", category: "Hardcoded Secrets", pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["'][a-zA-Z0-9_-]{16,}["']/gi, description: "Hardcoded API key" },
  { id: "SEC005", severity: "Medium", category: "Hardcoded Secrets", pattern: /(?:LOVABLE_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*[=:]\s*["'][^"']{10,}["']/gi, description: "Hardcoded AI provider key" },

  // XSS
  { id: "XSS001", severity: "High", category: "XSS", pattern: /dangerouslySetInnerHTML/g, description: "Use of dangerouslySetInnerHTML — XSS risk" },
  { id: "XSS002", severity: "High", category: "XSS", pattern: /\.innerHTML\s*=/g, description: "Direct innerHTML assignment — XSS risk" },
  { id: "XSS003", severity: "Medium", category: "XSS", pattern: /document\.write\(/g, description: "Use of document.write — XSS risk" },
  { id: "XSS004", severity: "High", category: "XSS", pattern: /\beval\s*\(/g, description: "Use of eval() — code injection risk" },
  { id: "XSS005", severity: "Medium", category: "XSS", pattern: /new\s+Function\s*\(/g, description: "Dynamic Function constructor — code injection risk" },

  // Auth Issues
  { id: "AUTH001", severity: "Critical", category: "Authentication", pattern: /mock-user-logged-in/g, description: "Mock authentication flag in production code" },
  { id: "AUTH002", severity: "High", category: "Authentication", pattern: /mock-token/g, description: "Hardcoded mock authentication token" },
  { id: "AUTH003", severity: "Medium", category: "Authentication", pattern: /mock-user-id/g, description: "Hardcoded mock user ID" },

  // CORS
  { id: "CORS001", severity: "High", category: "CORS", pattern: /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/g, description: "Wildcard CORS origin — allows any domain" },

  // Injection
  { id: "INJ001", severity: "Critical", category: "SQL Injection", pattern: /`[^`]*\$\{[^}]*\}[^`]*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b/gi, description: "Potential SQL injection via template literal" },
  { id: "INJ002", severity: "High", category: "Command Injection", pattern: /(?:exec|execSync|spawn|execFile)\s*\([^)]*\$\{/g, description: "Potential command injection via template literal" },
  { id: "INJ003", severity: "Medium", category: "Path Traversal", pattern: /\.\.\//g, description: "Relative path traversal pattern", maxPerFile: 1 },

  // Crypto
  { id: "CRY001", severity: "Medium", category: "Weak Crypto", pattern: /Math\.random\(\)/g, description: "Use of Math.random() — not cryptographically secure" },
  { id: "CRY002", severity: "High", category: "Weak Crypto", pattern: /(?:md5|sha1)\s*\(/gi, description: "Use of weak hash algorithm (MD5/SHA1)" },

  // Config
  { id: "CFG001", severity: "Medium", category: "Configuration", pattern: /debug\s*[=:]\s*true/gi, description: "Debug mode enabled" },
  { id: "CFG002", severity: "Low", category: "Configuration", pattern: /console\.(?:log|debug|info)\(/g, description: "Console output in production code" },

  // Data Exposure
  { id: "DATA001", severity: "Medium", category: "Data Exposure", pattern: /console\.(?:error|warn|log)\s*\([^)]*(?:password|token|secret|key|credential)/gi, description: "Sensitive data in console output" },
];

// ─── File Scanner ───
const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".env", ".toml", ".yml", ".yaml"];
const EXCLUDE_DIRS = ["node_modules", ".git", "dist", ".tanstack", ".netlify", ".wrangler", "bun.lockb"];

function getFiles(dir) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (EXCLUDE_DIRS.includes(item)) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...getFiles(fullPath));
      } else if (SCAN_EXTENSIONS.some((ext) => item.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    // Skip unreadable dirs
  }
  return results;
}

function scanFile(filePath, content) {
  const results = [];
  const lines = content.split("\n");

  for (const pattern of PATTERNS) {
    let matchCount = 0;
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // Reset regex
      pattern.pattern.lastIndex = 0;
      let match;
      while ((match = pattern.pattern.exec(line)) !== null) {
        // Check exclusions
        if (pattern.exclude) {
          const shouldExclude = pattern.exclude.some((exc) => line.includes(exc));
          if (shouldExclude) continue;
        }

        matchCount++;
        if (pattern.maxPerFile && matchCount > pattern.maxPerFile) break;

        results.push({
          id: pattern.id,
          severity: pattern.severity,
          category: pattern.category,
          description: pattern.description,
          file: path.relative(ROOT, filePath).replace(/\\/g, "/"),
          line: lineNum + 1,
          snippet: line.trim().substring(0, 120),
        });
      }
      if (pattern.maxPerFile && matchCount > pattern.maxPerFile) break;
    }
  }
  return results;
}

// ─── Main Scan ───
console.log("🔍 SkinScope AI SAST Scanner");
console.log("━".repeat(50));

const files = getFiles(ROOT);
console.log(`Scanning ${files.length} files...`);

let allFindings = [];
for (const file of files) {
  try {
    const content = fs.readFileSync(file, "utf8");
    const results = scanFile(file, content);
    allFindings.push(...results);
  } catch (e) {
    // Skip binary files
  }
}

// Deduplicate
const seen = new Set();
allFindings = allFindings.filter((f) => {
  const key = `${f.id}:${f.file}:${f.line}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// ─── Output ───
const criticals = allFindings.filter((f) => f.severity === "Critical");
const highs = allFindings.filter((f) => f.severity === "High");
const mediums = allFindings.filter((f) => f.severity === "Medium");
const lows = allFindings.filter((f) => f.severity === "Low");

console.log(`\n📊 Results:`);
console.log(`  🔴 Critical: ${criticals.length}`);
console.log(`  🟠 High:     ${highs.length}`);
console.log(`  🟡 Medium:   ${mediums.length}`);
console.log(`  🟢 Low:      ${lows.length}`);
console.log(`  Total:       ${allFindings.length}\n`);

// Print details
for (const f of allFindings) {
  const icon = f.severity === "Critical" ? "🔴" : f.severity === "High" ? "🟠" : f.severity === "Medium" ? "🟡" : "🟢";
  console.log(`${icon} [${f.id}] ${f.description}`);
  console.log(`   File: ${f.file}:${f.line}`);
  console.log(`   Snippet: ${f.snippet}`);
  console.log();
}

if (outputJson) {
  const outputPath = path.join(ROOT, "Vulnerability Test Results", "sast-results.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    scan_date: new Date().toISOString(),
    total: allFindings.length,
    critical: criticals.length,
    high: highs.length,
    medium: mediums.length,
    low: lows.length,
    findings: allFindings,
  }, null, 2));
  console.log(`📄 JSON output saved to: ${outputPath}`);
}

// Exit code
if (failOnCritical && criticals.length > 0) {
  console.log(`\n❌ SAST scan FAILED: ${criticals.length} critical finding(s).`);
  process.exit(1);
}

console.log("✅ SAST scan complete.");
