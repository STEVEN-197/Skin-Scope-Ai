/**
 * SkinScope AI — Selenium E2E Web Suite
 *
 * Drives headless Chrome against the deployed site and writes:
 *   - selenium-tests/Selenium_Web_Test_Report.xlsx   (300-case test plan + summary)
 *   - selenium-tests/selenium-audit-summary.json     (machine-readable totals)
 *
 * Honest reporting: only checks that really ran in the browser are PASS / FAIL.
 * Every other planned case is reported as NOT EXECUTED (never as PASS).
 *
 * Needs the test-only package `selenium-webdriver`:
 *   npm install --no-save selenium-webdriver
 */
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX = require("xlsx");

let sw = null;
try {
  sw = require("selenium-webdriver");
} catch {
  // Reported clearly in main(); we never fake results when the driver is missing.
}

const BASE_URL = (process.env.SKINSCOPE_BASE_URL || "https://skinscopeai-main.vercel.app").replace(
  /\/$/,
  "",
);
const HEADLESS = process.env.HEADLESS !== "false";
const WAIT_MS = 20000;

// ─── Real browser checks (public, unauthenticated flows) ───
const CHECKS = [
  {
    id: "TC_AUTH_001",
    name: "Sign-in page renders email and password inputs",
    run: async (d, { By, until }) => {
      await d.get(`${BASE_URL}/login`);
      await d.wait(until.elementLocated(By.id("email")), WAIT_MS);
      await d.wait(until.elementLocated(By.id("password")), WAIT_MS);
      return "Email and password inputs present on /login";
    },
  },
  {
    id: "TC_AUTH_002",
    name: "Sign-up page renders name, email and password inputs",
    run: async (d, { By, until }) => {
      await d.get(`${BASE_URL}/signup`);
      for (const id of ["name", "email", "password"]) {
        await d.wait(until.elementLocated(By.id(id)), WAIT_MS);
      }
      return "Name, email and password inputs present on /signup";
    },
  },
  {
    id: "TC_AUTH_003",
    name: "Submitting an empty sign-in form is blocked (stays on /login)",
    run: async (d, { By, until }) => {
      await d.get(`${BASE_URL}/login`);
      const submit = await d.wait(until.elementLocated(By.css("button[type='submit']")), WAIT_MS);
      await submit.click();
      await d.sleep(1000);
      const url = await d.getCurrentUrl();
      if (!url.includes("/login")) throw new Error(`Left /login after empty submit: ${url}`);
      return "Empty submit rejected; still on /login";
    },
  },
  {
    id: "TC_AUTH_004",
    name: "Sign-in page links to sign-up",
    run: async (d, { By, until }) => {
      await d.get(`${BASE_URL}/login`);
      const link = await d.wait(until.elementLocated(By.linkText("Create an account")), WAIT_MS);
      await link.click();
      await d.wait(until.urlContains("/signup"), WAIT_MS);
      return '"Create an account" navigates to /signup';
    },
  },
  {
    id: "TC_SECU_001",
    name: "Unauthenticated /dashboard redirects to /login",
    run: async (d, { until }) => {
      await d.get(`${BASE_URL}/dashboard`);
      await d.wait(until.urlContains("/login"), WAIT_MS);
      return "Redirected to /login";
    },
  },
  {
    id: "TC_SECU_002",
    name: "Unauthenticated /dashboard/analyze redirects to /login",
    run: async (d, { until }) => {
      await d.get(`${BASE_URL}/dashboard/analyze`);
      await d.wait(until.urlContains("/login"), WAIT_MS);
      return "Redirected to /login";
    },
  },
  {
    id: "TC_SECU_003",
    name: "Legacy mock-auth localStorage flag does not grant dashboard access",
    run: async (d, { until }) => {
      // Negative regression test: setting the deprecated client-side flag must not grant access.
      const legacyKey = ["mock", "user", "logged", "in"].join("-");
      await d.get(`${BASE_URL}/login`);
      await d.executeScript("localStorage.setItem(arguments[0], 'true')", legacyKey);
      try {
        await d.get(`${BASE_URL}/dashboard`);
        await d.wait(until.urlContains("/login"), WAIT_MS);
      } finally {
        await d.executeScript("localStorage.removeItem(arguments[0])", legacyKey);
      }
      return "Legacy flag ignored; still redirected to /login";
    },
  },
  {
    id: "TC_RESP_001",
    name: "Landing page declares viewport and theme-color meta tags",
    run: async (d, { By }) => {
      await d.get(BASE_URL);
      const viewport = await d.findElements(By.css('meta[name="viewport"]'));
      const theme = await d.findElements(By.css('meta[name="theme-color"]'));
      if (!viewport.length) throw new Error("viewport meta tag missing");
      if (!theme.length) throw new Error("theme-color meta tag missing");
      return "viewport and theme-color meta tags present";
    },
  },
  {
    id: "TC_RESP_002",
    name: 'Landing page title contains "SkinScope"',
    run: async (d) => {
      await d.get(BASE_URL);
      const title = await d.getTitle();
      if (!title.includes("SkinScope")) throw new Error(`Unexpected title: ${title}`);
      return `Title: ${title}`;
    },
  },
  {
    id: "TC_RESP_003",
    name: "Sign-in page renders at 375x812 mobile viewport",
    run: async (d, { By, until }) => {
      await d.manage().window().setRect({ width: 375, height: 812 });
      try {
        await d.get(`${BASE_URL}/login`);
        const email = await d.wait(until.elementLocated(By.id("email")), WAIT_MS);
        if (!(await email.isDisplayed())) throw new Error("email input not visible at 375px");
      } finally {
        await d.manage().window().setRect({ width: 1440, height: 900 });
      }
      return "Email input visible at 375x812";
    },
  },
];

// ─── 300-case test plan (modules mirror the app's feature areas) ───
const MODULES = [
  { name: "Authentication & Session", count: 40, prefix: "TC_AUTH" },
  { name: "Dashboard & Health Ring", count: 35, prefix: "TC_DASH" },
  { name: "Image Analysis & Vision AI", count: 35, prefix: "TC_ANLZ" },
  { name: "JARVIS Health Assistant", count: 30, prefix: "TC_JRVS" },
  { name: "Medical Reports & OCR", count: 30, prefix: "TC_MEDR" },
  { name: "Prescriptions & Reminders", count: 25, prefix: "TC_PRES" },
  { name: "Longitudinal Timeline", count: 25, prefix: "TC_TIME" },
  { name: "Doctor Sharing & PDF Export", count: 20, prefix: "TC_SHAR" },
  { name: "Family Profiles Management", count: 20, prefix: "TC_FAML" },
  { name: "Responsive Layouts (12 Viewports)", count: 25, prefix: "TC_RESP" },
  { name: "Security & Access Control", count: 15, prefix: "TC_SECU" },
];

async function buildDriver() {
  const chrome = require("selenium-webdriver/chrome");
  const options = new chrome.Options();
  if (HEADLESS) options.addArguments("--headless=new");
  options.addArguments(
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--window-size=1440,900",
  );

  // On Windows or Linux with standard Chrome (/opt/google/chrome/chrome), selenium-manager
  // resolves the matching driver automatically. Only override when an explicit env var is passed
  // or when only Chromium is installed.
  const driverPath = [process.env.CHROMEDRIVER_PATH].find((p) => p && fs.existsSync(p));
  const chromeBinary = [
    process.env.CHROME_BIN,
    fs.existsSync("/opt/google/chrome/chrome") ? "/opt/google/chrome/chrome" : null,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].find((p) => p && fs.existsSync(p));

  if (chromeBinary) options.setChromeBinaryPath(chromeBinary);

  const builder = new sw.Builder().forBrowser("chrome").setChromeOptions(options);
  if (driverPath) builder.setChromeService(new chrome.ServiceBuilder(driverPath));
  return builder.build();
}

async function runChecks() {
  const results = [];
  if (!sw) {
    return {
      results,
      driverError:
        "selenium-webdriver is not installed (run: npm install --no-save selenium-webdriver)",
    };
  }

  let driver;
  try {
    driver = await buildDriver();
  } catch (err) {
    return { results, driverError: `Could not start Chrome WebDriver: ${err.message}` };
  }

  try {
    for (const check of CHECKS) {
      const started = Date.now();
      console.log(`Running ${check.id}: ${check.name}`);
      try {
        const details = await check.run(driver, { By: sw.By, until: sw.until });
        results.push({
          id: check.id,
          name: check.name,
          status: "PASS",
          seconds: (Date.now() - started) / 1000,
          details,
        });
      } catch (err) {
        results.push({
          id: check.id,
          name: check.name,
          status: "FAIL",
          seconds: (Date.now() - started) / 1000,
          details: String(err.message || err).split("\n")[0],
        });
      }
    }
  } finally {
    await driver.quit().catch(() => {});
  }
  return { results, driverError: null };
}

function writeReports(results, driverError) {
  const byId = new Map(results.map((r) => [r.id, r]));
  const rows = [];
  let n = 1;

  for (const mod of MODULES) {
    for (let i = 1; i <= mod.count; i++) {
      const id = `${mod.prefix}_${String(i).padStart(3, "0")}`;
      const ran = byId.get(id);
      rows.push({
        "Case #": n++,
        "Test ID": id,
        Module: mod.name,
        "Test Scenario": ran ? ran.name : `Planned scenario #${i} — ${mod.name}`,
        Type: mod.prefix === "TC_SECU" ? "Security" : "Functional",
        Priority: i <= 5 ? "High" : i <= 15 ? "Medium" : "Low",
        "Execution Status": ran ? ran.status : "NOT EXECUTED",
        "Execution Time (s)": ran ? Number(ran.seconds.toFixed(2)) : "",
        Notes: ran
          ? ran.details
          : "Planned only — not automated in this run (needs an authenticated session or live data)",
      });
    }
  }

  const executed = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const notExecuted = rows.length - executed;
  const generatedAt = new Date().toISOString();

  const summary = [
    { Metric: "Total Planned Cases", Value: rows.length },
    { Metric: "Executed in Browser", Value: executed },
    { Metric: "Passed", Value: passed },
    { Metric: "Failed", Value: failed },
    { Metric: "Not Executed", Value: notExecuted },
    {
      Metric: "Pass Rate (of executed)",
      Value: executed ? `${((passed / executed) * 100).toFixed(1)}%` : "n/a",
    },
    {
      Metric: "Execution Environment",
      Value: `Chrome ${HEADLESS ? "Headless " : ""}/ selenium-webdriver`,
    },
    { Metric: "Target Base URL", Value: BASE_URL },
    { Metric: "Driver Status", Value: driverError || "OK" },
    {
      Metric: "Authenticated flows",
      Value: "See tests/selenium (pytest) — runs with TEST_USER_EMAIL / TEST_USER_PASSWORD",
    },
    { Metric: "Generated At", Value: generatedAt },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Test Details (300 Cases)");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");

  const outDir = path.resolve(__dirname, "..");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "Selenium_Web_Test_Report.xlsx");
  XLSX.writeFile(wb, outFile);

  const summaryJson = {
    total: rows.length,
    executed,
    passed,
    failed,
    notExecuted,
    baseUrl: BASE_URL,
    driverError: driverError || null,
    timestamp: generatedAt,
    checks: results,
  };
  fs.writeFileSync(
    path.join(outDir, "selenium-audit-summary.json"),
    JSON.stringify(summaryJson, null, 2),
  );

  console.log(
    `Selenium report written: ${outFile} (Planned: ${rows.length} | Executed: ${executed} | Passed: ${passed} | Failed: ${failed} | Not executed: ${notExecuted})`,
  );
  return summaryJson;
}

async function main() {
  console.log(`[Selenium Web Test] Target URL: ${BASE_URL} (Headless: ${HEADLESS})`);
  const { results, driverError } = await runChecks();
  const summary = writeReports(results, driverError);
  if (driverError) console.error(`ERROR: ${driverError}`);
  // Fail the job when a real check failed or the browser never ran — never report a false green.
  if (driverError || summary.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Selenium runner fatal error:", err);
  process.exit(1);
});
