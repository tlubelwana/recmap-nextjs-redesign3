#!/usr/bin/env python3
"""One-time migration: adds recommendation-type, GRADE/grading-approach,
world-region, age-group, and evidence-inspection fields to each record in
data/guidelines.json, without touching any existing field.

Classification for recommendationType / gradingApproach was done by reading
each guideline's recommendationText + strength + certainty fields (see the
mapping below) -- this is a first-pass classification from the extracted
text, not an independent re-review of the full guideline PDFs. That caveat
is also surfaced on the About page.
"""
import json
import pathlib

DATA_FILE = pathlib.Path(__file__).resolve().parent.parent / "data" / "guidelines.json"

# id -> (recommendationType, gradingApproach, gradeCertaintyLevel, classificationNote)
CLASSIFICATION = {
    "BMJ_CADe_2025_1": ("recommendation", "GRADE", "low_very_low", None),
    "AGA_CADe_2025_1": ("recommendation", "GRADE", "very_low", None),
    "ESGE_CADe_2023_1": (
        "additional_guidance",
        "not_grade",
        "low",
        "Source guideline uses GRADE elsewhere, but this specific AI statement is a narrative caveat ('more evidence is needed') rather than a formally graded recommendation.",
    ),
    "DDG_SKIN_2025_1": (
        "additional_guidance",
        "not_specified",
        "not_reported",
        "Descriptive statement about imaging + AI, not a graded recommendation in the extracted short-form guideline.",
    ),
    "CAR_LC_2025_1": (
        "good_practice_statement",
        "not_grade",
        "not_reported",
        "Reads as a practical oversight directive ('should be performed with radiologist oversight') rather than an evidence-graded recommendation -- classic Good Practice Statement pattern.",
    ),
    "CS_JHRS_ARR_2022_3": (
        "recommendation",
        "GRADE",
        "not_reported",
        "Source 'certainty' field contains an anomalous value ('Weak') that duplicates the strength field -- likely a data-entry artifact. Certainty is therefore treated as not clearly reported pending re-extraction.",
    ),
    "SG_TB_2024_1": (
        "additional_guidance",
        "not_specified",
        "not_reported",
        None,
    ),
    "GUPS_PC_2020_1": (
        "research_recommendation",
        "not_grade",
        "not_reported",
        "Text explicitly frames AI/digital pathology as premature for recommendation and calls for further research.",
    ),
    "ESGE_CADe_2025_1": ("recommendation", "GRADE", "low", None),
    "ESR_BREAST_2025_1": ("recommendation", "GRADE", "low", None),
    "AGA_GC_2024_1": ("recommendation", "GRADE", "low", None),
    "CTS_2026_1": ("recommendation", "GRADE", "very_low", None),
    "CCA_2021_1": ("recommendation", "GRADE", "low", None),
}

WORLD_REGION = {
    "International": "Global / multinational",
    "USA": "North America",
    "Canada": "North America",
    "Europe": "Europe",
    "Germany": "Europe",
    "Japan": "Asia-Pacific",
    "Singapore": "Asia-Pacific",
    "Australia": "Asia-Pacific",
}

CERTAINTY_LABEL = {
    "high": "High",
    "moderate": "Moderate",
    "low": "Low",
    "low_very_low": "Low / Very low",
    "very_low": "Very low",
    "not_reported": "Not reported",
}

GRADING_LABEL = {
    "GRADE": "GRADE",
    "not_grade": "Not GRADE-based",
    "not_specified": "Not specified in source",
}

TYPE_LABEL = {
    "recommendation": "Recommendation",
    "good_practice_statement": "Good Practice Statement",
    "additional_guidance": "Additional Guidance",
    "research_recommendation": "Research Recommendation",
}


def main():
    records = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    missing = []
    for r in records:
        rid = r["id"]
        if rid not in CLASSIFICATION:
            missing.append(rid)
            continue
        rec_type, grading, certainty_level, note = CLASSIFICATION[rid]
        r["recommendationType"] = rec_type
        r["recommendationTypeLabel"] = TYPE_LABEL[rec_type]
        r["gradingApproach"] = grading
        r["gradingApproachLabel"] = GRADING_LABEL[grading]
        r["gradeCertaintyLevel"] = certainty_level
        r["gradeCertaintyLabel"] = CERTAINTY_LABEL[certainty_level]
        r["classificationNote"] = note
        r["worldRegion"] = WORLD_REGION.get(r.get("region", ""), "Not specified")
        r["ageGroup"] = "Adults"
        r["evidence"] = {
            "sofAvailable": False,
            "sofNote": "Summary-of-Findings table not yet linked for this recommendation -- see the source guideline PDF.",
            "etdAvailable": False,
            "etdNote": "Evidence-to-Decision table not yet linked for this recommendation -- see the source guideline PDF.",
            "primaryStudiesNote": "Underlying primary studies are not individually listed here yet; consult the source guideline's reference list.",
            "magicappUrl": None,
        }
        r["lastCheckedISO"] = "2026-09-05"
    if missing:
        raise SystemExit(f"No classification entry for ids: {missing}")
    DATA_FILE.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {len(records)} records.")


if __name__ == "__main__":
    main()
