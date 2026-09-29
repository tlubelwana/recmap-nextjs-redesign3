#!/usr/bin/env python3
"""
Migrate real AGREE-REX appraisal data (from AGREEREX_results.xlsx, a
two-appraiser AI appraisal of all 13 guidelines against the published 2019
AGREE-REX instrument) into data/guidelines.json, replacing the previous
"eligible_not_yet_appraised" placeholder with a real `rex` object for every
recommendation whose PARENT GUIDELINE cleared the AGREE II quality gate.

Guidelines that did NOT clear the gate keep status "not_eligible" and
rex: null, even though the source workbook appraised all 13 unconditionally
- the gate is RecMap's own protocol precondition, not just a placeholder for
missing data (see lib/types.ts#AgreeRexAppraisal doc comment).

Run once: python3 scripts/migrate_agree_rex_real_data.py
"""
import json
import openpyxl
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
XLSX_PATH = "/root/.claude/uploads/ee08d4fd-97cb-5c66-a6c6-3d17575d51fe/87fe1d28-AGREEREX_results.xlsx"
GUIDELINES_PATH = ROOT / "data" / "guidelines.json"

# Mirrors lib/agreeRexInstrument.ts exactly - domain assignment by item number.
ITEM_DOMAIN = {
    1: ("clinical_applicability", "Clinical Applicability"),
    2: ("clinical_applicability", "Clinical Applicability"),
    3: ("clinical_applicability", "Clinical Applicability"),
    4: ("values_and_preferences", "Values & Preferences"),
    5: ("values_and_preferences", "Values & Preferences"),
    6: ("values_and_preferences", "Values & Preferences"),
    7: ("values_and_preferences", "Values & Preferences"),
    8: ("implementability", "Implementability"),
    9: ("implementability", "Implementability"),
}
# lib/agreeRexInstrument.ts's own item text (kept as the single source of
# truth for display text; the xlsx's short item labels are not reused here).
ITEM_TEXT = {
    1: "The evidence supporting the recommendation is applicable to the clinical question at hand",
    2: "The recommendation is applicable to the target users it is intended for",
    3: "The recommendation is applicable to the target patients/populations it is intended for",
    4: "The recommendation reflects the values and preferences of target users",
    5: "The recommendation reflects the values and preferences of target patients/populations",
    6: "The recommendation reflects the values and preferences of policy/decision makers",
    7: "The recommendation reflects the values and preferences of the guideline developers",
    8: "The purpose of the recommendation is clear and actionable",
    9: "The recommendation is feasible for local application and adoption",
}

METHOD_NOTE = (
    "AI-generated first-pass appraisal, not a validated substitute for trained human "
    "appraisers - every score here should be checked against the source guideline PDF "
    "before being used in a real decision. The two ‘appraisers’ are two independent "
    "runs of the same model, so their agreement is not evidence of inter-rater "
    "reliability in the usual sense. Appraisals are based on machine-extracted PDF "
    "text; content carried only in figures or complex tables may have been missed, "
    "which matters most for the two Implementability items."
)


def main():
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    summary_ws = wb["Summary"]
    summary_rows = list(summary_ws.iter_rows(values_only=True))[1:]
    summary_by_id = {}
    for r in summary_rows:
        gid = r[0]
        if not gid or gid.startswith("MEAN"):
            continue
        summary_by_id[gid] = {
            "domain_pct": [r[5], r[6], r[7]],  # Domain1, Domain2, Domain3 (%)
            "all_items_pct": r[8],
            "overall_a": r[9],
            "overall_b": r[10],
            "agree": r[11] == "Yes",
        }

    items_ws = wb["Item scores"]
    item_rows = list(items_ws.iter_rows(values_only=True))[1:]
    items_by_id = {}
    for r in item_rows:
        gid, _domain, item_no, _item, score_a, score_b, mean, diff, _flag, rat_a, rat_b = r
        items_by_id.setdefault(gid, []).append(
            {
                "num": item_no,
                "scoreA": score_a,
                "scoreB": score_b,
                "mean": mean,
                "difference": diff,
                "rationaleA": rat_a or "",
                "rationaleB": rat_b or "",
            }
        )

    guidelines = json.loads(GUIDELINES_PATH.read_text())
    updated = 0
    for g in guidelines:
        gid = g.get("guidelineId")
        rex_appraisal = g["agreeRex"]
        if not rex_appraisal.get("gatePassed"):
            # Not eligible under RecMap's own protocol - leave as-is
            # (status "not_eligible", rex null), even though the source
            # workbook appraised this guideline too.
            continue
        if gid not in summary_by_id or gid not in items_by_id:
            raise SystemExit(f"No AGREE-REX data found for gate-passed guideline {gid!r}")

        s = summary_by_id[gid]
        raw_items = sorted(items_by_id[gid], key=lambda x: x["num"])
        if len(raw_items) != 9:
            raise SystemExit(f"Expected 9 AGREE-REX items for {gid!r}, found {len(raw_items)}")

        # Build the 3 domains with their items.
        domains = []
        for domain_key, domain_label in [
            ("clinical_applicability", "Clinical Applicability"),
            ("values_and_preferences", "Values & Preferences"),
            ("implementability", "Implementability"),
        ]:
            domain_items = [it for it in raw_items if ITEM_DOMAIN[it["num"]][0] == domain_key]
            domains.append(
                {
                    "key": domain_key,
                    "label": domain_label,
                    "items": [
                        {
                            "num": it["num"],
                            "text": ITEM_TEXT[it["num"]],
                            "score": round(it["mean"], 2),
                            "scoreA": it["scoreA"],
                            "scoreB": it["scoreB"],
                            "difference": it["difference"],
                            "rationaleA": it["rationaleA"],
                            "rationaleB": it["rationaleB"],
                        }
                        for it in domain_items
                    ],
                }
            )
        # Attach standardised domain score01/score7 from the Summary sheet
        # (NOT re-derived from the item mean - see AgreeRexDomain doc comment).
        for i, d in enumerate(domains):
            pct = s["domain_pct"][i]
            d["score01"] = round(pct / 100, 4)
            d["score7"] = round((pct / 100) * 7, 2)

        items_with_disagreement = sum(1 for it in raw_items if it["difference"] and it["difference"] > 0)

        rex_appraisal["rex"] = {
            "domains": domains,
            "overall7": round((s["all_items_pct"] / 100) * 7, 2),
            "overallPct": round(s["all_items_pct"], 1),
            "overallAssessment": {
                "appraiserA": s["overall_a"],
                "appraiserB": s["overall_b"],
                "appraisersAgree": s["agree"],
            },
            "itemsWithDisagreement": items_with_disagreement,
            "method": {
                "appraiserCount": 2,
                "aiGenerated": True,
                "note": METHOD_NOTE,
            },
        }
        rex_appraisal["status"] = "appraised"
        updated += 1

    GUIDELINES_PATH.write_text(json.dumps(guidelines, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {updated} gate-passed guidelines with real AGREE-REX data.")


if __name__ == "__main__":
    main()
