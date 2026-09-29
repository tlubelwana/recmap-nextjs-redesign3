import type { Guideline } from "@/lib/types";

export default function DeviceLifecyclePanel({ rec }: { rec: Guideline }) {
  const device = rec.deviceCrossReference;
  const lifecycle = rec.lifecycle;
  const lifecycleLabel = lifecycle?.state === "not_assessed" || !lifecycle ? "Not yet assessed" : lifecycle.state;

  return (
    <section className="device-lifecycle-panel">
      <div className="device-lifecycle-head">
        <div>
          <div className="dsec-label">Applicability and lifecycle</div>
          <p>These fields separate the system actually studied from the broader label “AI”.</p>
        </div>
        <span className="pill plain">Lifecycle: {lifecycleLabel}</span>
      </div>
      {device ? (
        <div className="device-lifecycle-grid">
          <div><b>Device / model</b><span>{device.deviceName}{device.modelVersion ? ` · ${device.modelVersion}` : ""}</span></div>
          <div><b>FDA status</b><span>{device.fdaStatus ?? "Not reported"}</span></div>
          <div><b>CE status</b><span>{device.ceStatus ?? "Not reported"}</span></div>
          <div><b>Indication</b><span>{device.clearedIndication ?? "Not reported"}</span></div>
        </div>
      ) : (
        <p className="device-lifecycle-muted">
          Device/model and regulatory cross-reference not yet assessed for this recommendation. A broad AI label
          should not be treated as evidence that every product applies.
        </p>
      )}
      {lifecycle?.note && <p className="device-lifecycle-muted">{lifecycle.note}</p>}
      {lifecycle?.replacedByGuidelineId && <p className="device-lifecycle-muted">Superseded by: {lifecycle.replacedByGuidelineId}</p>}
      <style jsx global>{`
        .device-lifecycle-panel { border: 1px solid var(--line-200); border-radius: 10px; padding: 14px; background: var(--bg-alt); }
        .device-lifecycle-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .device-lifecycle-head p, .device-lifecycle-muted { margin: 6px 0 0; color: var(--ink-600); font-size: 12.5px; line-height: 1.55; }
        .device-lifecycle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin-top: 12px; }
        .device-lifecycle-grid div { display: flex; flex-direction: column; gap: 3px; }
        .device-lifecycle-grid b { color: var(--ink-600); font-size: 11px; text-transform: uppercase; }
        .device-lifecycle-grid span { color: var(--ink-800); font-size: 13px; }
        @media (max-width: 560px) { .device-lifecycle-head, .device-lifecycle-grid { display: flex; flex-direction: column; } }
      `}</style>
    </section>
  );
}