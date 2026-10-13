import xml.etree.ElementTree as ET
import os
import sys

summary_file = os.getenv("GITHUB_STEP_SUMMARY")
if not summary_file:
    print("GITHUB_STEP_SUMMARY not set, printing to stdout")
    summary_out = sys.stdout
else:
    summary_out = open(summary_file, "a", encoding="utf-8")

def parse_junit(path):
    if not os.path.exists(path):
        return 0, 0, 0, 0, []
    tree = ET.parse(path)
    total = passed = failed = skipped = 0
    cases = []
    for tc in tree.iter("testcase"):
        total += 1
        name = tc.get("name", "test")
        cls = tc.get("classname", "")
        time_s = float(tc.get("time", 0))
        if tc.find("failure") is not None or tc.find("error") is not None:
            status = "FAIL"
            failed += 1
        elif tc.find("skipped") is not None:
            status = "SKIP"
            skipped += 1
        else:
            status = "PASS"
            passed += 1
        cases.append({"name": name, "class": cls, "status": status, "time": time_s})
    return total, passed, failed, skipped, cases

total, passed, failed, skipped, cases = parse_junit("selenium-results.xml")

pass_pct = round((passed / total * 100), 1) if total else 0
fail_pct = round((failed / total * 100), 1) if total else 0
skip_pct = round((skipped / total * 100), 1) if total else 0

# Mermaid Pie Chart & Summary Dashboard
md = f"""
## 🧪 Selenium & PWA Test Execution Dashboard

```mermaid
pie title Selenium Automation Results (Total: {total})
    "Passed ({passed})" : {passed}
    "Failed ({failed})" : {failed}
    "Skipped / Preview ({skipped})" : {skipped}
```

### 📊 Results Overview
| Metric | Count | Percentage | Status |
| :--- | :---: | :---: | :---: |
| ✅ **Passed** | **{passed}** | {pass_pct}% | `Success` |
| ❌ **Failed** | **{failed}** | {fail_pct}% | `Review` |
| ⏭️ **Skipped** | **{skipped}** | {skip_pct}% | `Mock/Unprovisioned` |
| 📈 **Total Tests** | **{total}** | 100% | `Executed` |

---
"""

summary_out.write(md)
if summary_file:
    summary_out.close()

print(f"Summary generated: {total} tests, {passed} passed, {failed} failed, {skipped} skipped")
