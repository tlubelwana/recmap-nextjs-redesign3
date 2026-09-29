import Link from "next/link";
import { UPLOAD_FEATURE_ENABLED } from "@/lib/config";

export default function UploadPage() {
  return (
    <div className="upload-hero">
      <span className="eyebrow">Curated additions</span>
      <h1 className="upload-h1 wordmark">Suggest a guideline for RecMap</h1>
      <p className="upload-sub">
        RecMap does not accept unreviewed user uploads directly into the catalog. This page explains what to send
        for consideration and how a proposed guideline will be checked before it becomes visible to users.
      </p>

      <div className="upload-guidance-grid">
        <section className="upload-guidance-card">
          <span className="eyebrow">What to suggest</span>
          <ul>
            <li>Guideline title, publishing organisation, year, and jurisdiction.</li>
            <li>A stable public source link or official PDF.</li>
            <li>The AI-related clinical recommendation and its target population.</li>
            <li>Any existing AGREE II, GRADE, or recommendation-level appraisal.</li>
          </ul>
        </section>
        <section className="upload-guidance-card">
          <span className="eyebrow">What happens next</span>
          <ol>
            <li>Confirm the document is an eligible clinical practice guideline.</li>
            <li>Extract and cite the recommendation and PICO details.</li>
            <li>Run appraisal and label estimates clearly.</li>
            <li>Human-check the record before catalog publication.</li>
          </ol>
        </section>
      </div>

      <div className="upload-transparency-note">
        <b>Why no direct upload?</b> An open upload would make unverified material look like established guidance.
        Keeping intake curated protects the evidence map&rsquo;s traceability and makes the review status visible.
      </div>
      <div className="upload-actions">
        <Link href="/catalog" className="btn-primary">Browse the curated catalog</Link>
        <Link href="/ask" className="btn-outline">Back to Ask</Link>
      </div>
      {UPLOAD_FEATURE_ENABLED && (
        <p className="upload-admin-note">Controlled administrator intake is enabled for this deployment.</p>
      )}
    </div>
  );
}
