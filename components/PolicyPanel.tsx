"use client";

import {
  AGREE_ITEM_BARRIERS,
  AGREE_ITEM_COMPETING_INTERESTS,
  AGREE_ITEM_FUNDING,
  AGREE_ITEM_MONITORING,
  AGREE_ITEM_RESOURCE,
  AGREE_ITEM_TOOLS,
  findAgreeItem,
  itemVerdict,
  strengthCertaintyDiscordance,
} from "@/lib/audienceLens";
import type { Guideline, GuidelineGroup } from "@/lib/types";

/**
 * The policy / health-system view of one recommendation.
 *
 * A policymaker reads a guideline to answer four questions a clinician does
 * not ask: what will it cost, will it work here, can I measure it, and can I
 * defend it. Every one of those has an existing home in the appraisal data,
 * but in a clinician-first layout they sit at the bottom of AGREE II Domain 5
 * where nobody reads them. This panel hoists them to the top.
 *
 * The most important behaviour here is the null state. AGREE II item 20
 * (resource implications) and item 21 (monitoring and auditing criteria) are
 * routinely the lowest-scoring items in any guideline corpus, and a low score
 * means the GUIDELINE did not address it — not that the intervention is
 * unaffordable or unmeasurable. That distinction is stated on every card
 * rather than left to the reader, because getting it backwards would be a
 * consequential misreading.
 */

function ItemCard({
  label,
  question,
  item,
  emptyHint,
}: {
  label: string;
  question: string;
  item: { num: number; score: number; appraisal: string } | null;
  emptyHint: string;
}) {
  const verdict = itemVerdict(item?.score);
  return (
    <div className={`pol-card pol-${verdict.tone}`}>
      <div className="pol-card-top">
        <span className="pol-card-k">{label}</span>
        <span className={`pol-verdict pol-verdict-${verdict.tone}`}>
          {verdict.label}
          {item ? ` · ${item.score}/7` : ""}
        </span>
      </div>
      <div className="pol-question">{question}</div>
      <p className="pol-appraisal">{item ? item.appraisal : emptyHint}</p>
      {item && (
        <div className="pol-src">
          AGREE&nbsp;II item {item.num}
          {item.score <= 3 && " · the guideline does not address this — not a judgement about the intervention"}
        </div>
      )}
    </div>
  );
}

export default function PolicyPanel({ rec, group }: { rec: Guideline; group: GuidelineGroup }) {
  const resource = findAgreeItem(group.agree, AGREE_ITEM_RESOURCE);
  const monitoring = findAgreeItem(group.agree, AGREE_ITEM_MONITORING);
  const barriers = findAgreeItem(group.agree, AGREE_ITEM_BARRIERS);
  const tools = findAgreeItem(group.agree, AGREE_ITEM_TOOLS);
  const funding = findAgreeItem(group.agree, AGREE_ITEM_FUNDING);
  const interests = findAgreeItem(group.agree, AGREE_ITEM_COMPETING_INTERESTS);

  const rex = rec.agreeRex.status === "appraised" ? rec.agreeRex.rex : null;
  const implementability = rex?.domains.find((d) => d.key === "implementability") ?? null;
  const values = rex?.domains.find((d) => d.key === "values_and_preferences") ?? null;
  const discordant = strengthCertaintyDiscordance(rec);

  return (
    <section className="pol-wrap">
      <div className="pol-headline-row">
        <div className="pol-metric">
          <span className="pol-metric-k">Implementability</span>
          <span className="pol-metric-v">
            {implementability ? `${Math.round(implementability.score01 * 100)}%` : "—"}
          </span>
          <span className="pol-metric-s">
            {implementability
              ? "AGREE-REX Domain 3 (items 8–9): purpose, local application and adoption"
              : rec.agreeRex.status === "not_eligible"
                ? "Not eligible — parent guideline did not clear the AGREE II gate"
                : "Eligible, not yet appraised"}
          </span>
        </div>
        <div className="pol-metric">
          <span className="pol-metric-k">Stakeholder values</span>
          <span className="pol-metric-v">{values ? `${Math.round(values.score01 * 100)}%` : "—"}</span>
          <span className="pol-metric-s">
            AGREE-REX Domain 2 — includes item 6, whether policy and decision-makers&rsquo; needs were considered
          </span>
        </div>
        <div className="pol-metric">
          <span className="pol-metric-k">Origin</span>
          <span className="pol-metric-v pol-metric-text">{group.worldRegion}</span>
          <span className="pol-metric-s">
            {group.organization}, {group.year} — check transferability before adopting outside this setting
          </span>
        </div>
      </div>

      {discordant && (
        <div className="pol-flag">
          <b>Strong recommendation on low-certainty evidence.</b> This combination is the one most likely to be
          challenged: the position is firm but the evidence base behind it is not. Expect to have to justify it, and
          note whether the guideline gives its reasoning for the mismatch.
        </div>
      )}

      <div className="pol-grid">
        <ItemCard
          label="Cost"
          question="What will it take to resource?"
          item={resource}
          emptyHint="This guideline was not appraised on resource implications."
        />
        <ItemCard
          label="Measurement"
          question="Can adherence be monitored and audited?"
          item={monitoring}
          emptyHint="This guideline was not appraised on monitoring or auditing criteria."
        />
        <ItemCard
          label="Feasibility"
          question="What gets in the way of applying it?"
          item={barriers}
          emptyHint="This guideline was not appraised on facilitators and barriers."
        />
        <ItemCard
          label="Support"
          question="Are there tools for putting it into practice?"
          item={tools}
          emptyHint="This guideline was not appraised on implementation tools."
        />
      </div>

      <div className="pol-grid">
        <ItemCard
          label="Independence"
          question="Was funding-body influence addressed?"
          item={funding}
          emptyHint="Not appraised."
        />
        <ItemCard
          label="Independence"
          question="Were competing interests recorded and addressed?"
          item={interests}
          emptyHint="Not appraised."
        />
      </div>

      <div className={`pol-equity pol-equity-${rec.equity.evaluated ? "yes" : "no"}`}>
        <span className="pol-card-k">Equity impact</span>
        <p className="pol-appraisal">
          {rec.equity.evaluated
            ? `Differential impact assessed for: ${rec.equity.dimensionsAddressed.join(", ")}. ${rec.equity.note}`
            : rec.equity.note}
        </p>
        <div className="pol-src">
          PROGRESS-Plus framework · absence of an equity analysis is a property of the source guideline, and is itself
          a finding for a coverage decision
        </div>
      </div>

      <style jsx global>{`
        .pol-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pol-headline-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        @media (max-width: 720px) {
          .pol-headline-row {
            grid-template-columns: 1fr;
          }
        }
        .pol-metric {
          padding: 12px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .pol-metric-k {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-400);
        }
        .pol-metric-v {
          font-size: 24px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.1;
        }
        .pol-metric-text {
          font-size: 15px;
          line-height: 1.3;
        }
        .pol-metric-s {
          font-size: 11px;
          line-height: 1.5;
          color: var(--ink-500);
        }
        .pol-flag {
          padding: 11px 14px;
          border-radius: 10px;
          background: var(--against-bg);
          border: 1px solid var(--against-border);
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-800);
        }
        .pol-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 620px) {
          .pol-grid {
            grid-template-columns: 1fr;
          }
        }
        .pol-card {
          padding: 12px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .pol-card.pol-absent {
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
        .pol-card-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .pol-card-k {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-400);
        }
        .pol-verdict {
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .pol-verdict-absent {
          color: var(--against);
        }
        .pol-verdict-weak {
          color: var(--accent-ink);
        }
        .pol-verdict-partial,
        .pol-verdict-good {
          color: var(--favour);
        }
        .pol-question {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--ink-900);
          margin: 3px 0 5px;
        }
        .pol-appraisal {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-700);
        }
        .pol-src {
          margin-top: 7px;
          font-size: 11px;
          color: var(--ink-500);
          line-height: 1.5;
        }
        .pol-equity {
          padding: 12px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .pol-equity-no {
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
      `}</style>
    </section>
  );
}
