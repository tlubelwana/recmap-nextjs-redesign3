export default function SignalPinMark({ size = 24 }: { size?: number }) {
  return (
    <span className="signal-pin-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.88} height={size * 0.88} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="9" r="7" stroke="#ffffff" strokeDasharray="1.5 3" strokeWidth="1.2" opacity="0.7" />
        <path d="M12 22 16 12a4.5 4.5 0 1 0-8 0l4 10Z" fill="#ffffff" />
        <path d="m9.2 9.2 2 1.8 3.8-3.6" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16.5" cy="3.5" r="1.1" fill="var(--accent)" />
      </svg>
    </span>
  );
}