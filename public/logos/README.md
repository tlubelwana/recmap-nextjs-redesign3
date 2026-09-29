# Organisation logos

Drop a logo here and the "Guidelines referenced" rows on the Ask page pick
it up automatically — nothing else needs changing. Any organisation without
a file falls back to its monogram tile.

**Filename** = the organisation string from `data/guidelines.json`,
lowercased, `&` expanded to "and", and every run of non-alphanumeric
characters replaced with a single hyphen. `.png` is tried first, then
`.svg`. See `orgLogoSlug()` in `components/OrgLogo.tsx` — that function is
the source of truth.

Square-ish, transparent background, at least 112px on the short side (the
tile renders at 56px, so this covers retina).

Guideline organisations' logos are their trademarks. Only add files you have
the right to display.

## Filenames for the organisations currently in the catalog

- `american-gastroenterological-association-aga.png` — American Gastroenterological Association (AGA)
- `bmj-rapid-recommendations.png` — BMJ Rapid Recommendations
- `canadian-association-of-radiologists-car-canadian-society-of-thoracic-radiologists-cstr.png` — Canadian Association of Radiologists (CAR) + Canadian Society of Thoracic Radiologists (CSTR)
- `cancer-council-australia.png` — Cancer Council Australia
- `european-society-of-breast-imaging-eusobi-european-society-of-radiology-esr.png` — European Society of Breast Imaging (EUSOBI) / European Society of Radiology (ESR)
- `european-society-of-gastrointestinal-endoscopy-esge.png` — European Society of Gastrointestinal Endoscopy (ESGE)
- `genitourinary-pathology-society-gups.png` — Genitourinary Pathology Society (GUPS)
- `german-dermatological-society-ddg.png` — German Dermatological Society (DDG)
- `japanese-circulation-society-jcs-and-japanese-heart-rhythm-society-jhrs.png` — Japanese Circulation Society (JCS) & Japanese Heart Rhythm Society (JHRS)
- `national-tb-programme-singapore.png` — National TB Programme, Singapore
- `the-canadian-thoracic-society-canadian-sleep-society.png` — The Canadian Thoracic Society/Canadian Sleep Society
