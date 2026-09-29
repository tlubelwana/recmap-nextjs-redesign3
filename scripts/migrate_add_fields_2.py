#!/usr/bin/env python3
"""
One-time migration adding the six-feature "batch 2" fields to every record
in data/guidelines.json: agreeRex (two-tier quality appraisal), coding
(ICD-11 / SNOMED CT / ATC-DDD), and equity (PROGRESS-Plus).

Every guideline in the shipped dataset currently has exactly one
recommendation record per guidelineId, so this is keyed by guidelineId.
CLINICAL_CODING below is deliberately conservative: ICD-11 codes are only
set where they were independently web-verified (see the project notes);
everywhere a precise code could not be verified, or the terminology
genuinely doesn't apply to this dataset (ATC/DDD, a drug index, for
AI/software interventions), the field is honestly left null with an
explanatory note rather than guessed.
"""
import json

GUIDELINES_PATH = "data/guidelines.json"

# --- Clinical coding, per guidelineId ---------------------------------
# icd11: (code, label) or None
CLINICAL_CODING = {
    "BMJ_CADe_2025": {
        "icd11": ("2B90", "Malignant neoplasms of colon"),
        "icd11_note": None,
    },
    "AGA_CADe_2025": {
        "icd11": ("2B90", "Malignant neoplasms of colon"),
        "icd11_note": None,
    },
    "ESGE_CADe_2025": {
        "icd11": ("2B90", "Malignant neoplasms of colon"),
        "icd11_note": None,
    },
    "ESGE_BE_2023": {
        "icd11": ("DA23.0", "Barrett's oesophagus"),
        "icd11_note": None,
    },
    "DDG_SKIN_2025": {
        "icd11": None,
        "icd11_note": (
            "This guideline covers AI-assisted imaging diagnostics across skin "
            "disease broadly, not one specific dermatologic condition — there is "
            "no single ICD-11 category to assign without over-specifying scope. "
            "Left uncoded rather than picking an arbitrary skin-disease code."
        ),
    },
    "CAR_LC_2025": {
        "icd11": ("2C25", "Malignant neoplasms of bronchus or lung"),
        "icd11_note": None,
    },
    "CS_JHRS_ARR_2022": {
        "icd11": ("BC81.3", "Atrial fibrillation"),
        "icd11_note": (
            "Recommendation population is described more broadly as \"suspected "
            "or confirmed arrhythmias,\" but the recommendation text itself is "
            "specifically about an AI atrial-fibrillation diagnosis function — "
            "coded to atrial fibrillation, the condition actually being detected."
        ),
    },
    "SG_TB_2024": {
        "icd11": ("1B10", "Tuberculosis of the respiratory system"),
        "icd11_note": None,
    },
    "GUPS_PC_2020": {
        "icd11": ("2C82", "Malignant neoplasms of prostate"),
        "icd11_note": None,
    },
    "ESR_BREAST_2025": {
        "icd11": ("2C61", "Malignant neoplasms of breast"),
        "icd11_note": None,
    },
    "AGA_GC_2024": {
        "icd11": ("2B72", "Malignant neoplasms of stomach"),
        "icd11_note": None,
    },
    "CTS_2026": {
        "icd11": ("7A41", "Obstructive sleep apnoea"),
        "icd11_note": None,
    },
    "CCA_2021": {
        "icd11": ("2C30", "Melanoma of skin"),
        "icd11_note": None,
    },
}

SNOMED_NOTE = (
    "Not yet coded. SNOMED CT concept IDs are precise enough that an "
    "unverified guess would risk misrepresenting the population/finding — "
    "left honestly uncoded pending a proper terminology-mapping pass rather "
    "than fabricated."
)

ATC_DDD_NOTE_SOFTWARE = (
    "Not applicable. ATC/DDD classifies pharmacological substances by "
    "chemical/therapeutic/pharmacological subgroup; this recommendation "
    "concerns an AI/software diagnostic tool, not a drug, so no ATC/DDD "
    "code applies."
)

EQUITY_NOTE_DEFAULT = (
    "Not evaluated. This guideline's extracted recommendation text does not "
    "discuss differential impact on any PROGRESS-Plus dimension — this "
    "reflects what the source guideline itself addresses, not a gap in "
    "RecMap's extraction. Framework: PROGRESS-Plus (as used by the "
    "chronic-pain RecMap protocol's own equity work)."
)


def build_agree_rex(overall7: float) -> dict:
    pct = round((overall7 / 7) * 100, 1)
    gate_passed = pct >= 70.0  # see lib/config.ts AGREE_GATE_THRESHOLD_PCT
    return {
        "gatePassed": gate_passed,
        "parentAgreeOverallPct": pct,
        "rex": None,
        "status": "eligible_not_yet_appraised" if gate_passed else "not_eligible",
    }


def build_coding(guideline_id: str) -> dict:
    entry = CLINICAL_CODING.get(guideline_id)
    if entry is None:
        raise KeyError(f"No clinical coding entry for {guideline_id}")
    icd11 = None
    if entry["icd11"] is not None:
        code, label = entry["icd11"]
        icd11 = {"code": code, "label": label, "system": "ICD-11"}
    return {
        "icd11": icd11,
        "icd11Note": entry["icd11_note"],
        "snomedCt": None,
        "snomedCtNote": SNOMED_NOTE,
        "atcDdd": None,
        "atcDddNote": ATC_DDD_NOTE_SOFTWARE,
    }


def build_equity() -> dict:
    return {
        "evaluated": False,
        "dimensionsAddressed": [],
        "note": EQUITY_NOTE_DEFAULT,
    }


def main() -> None:
    with open(GUIDELINES_PATH, "r", encoding="utf-8") as f:
        records = json.load(f)

    updated = 0
    for rec in records:
        gid = rec["guidelineId"]
        rec["agreeRex"] = build_agree_rex(rec["agree"]["overall7"])
        rec["coding"] = build_coding(gid)
        rec["equity"] = build_equity()
        updated += 1

    with open(GUIDELINES_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Updated {updated} records.")


if __name__ == "__main__":
    main()
