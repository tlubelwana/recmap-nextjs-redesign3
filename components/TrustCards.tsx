/**
 * The three trust cards that sit under the Ask hero, per the v3 snapshot:
 * a solid teal disc holding a white icon, a teal heading, and two lines of
 * supporting copy. Purely presentational — it makes a claim about how the
 * app works, so each line has to stay true to what RecMap actually does.
 *
 * Server component: no state, no effects, nothing interactive.
 */

const CARDS = [
  {
    key: "trustworthy",
    title: "Trustworthy",
    body: "All content comes from clinical practice guidelines that are AGREE II appraised.",
    icon: (
      <>
        <path d="M12 3.2 5.4 6v6c0 4.2 2.8 7.4 6.6 8.8 3.8-1.4 6.6-4.6 6.6-8.8V6Z" />
        <path d="m9.2 12.1 2 2 3.6-3.8" />
      </>
    ),
  },
  {
    key: "plain-language",
    title: "Plain language",
    body: "Answers are written in clear, plain language to support informed decisions.",
    icon: (
      <>
        <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.2 20.7l1.3-3.7a6.8 6.8 0 0 1-2-4.8C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z" />
        <path d="M8.4 12.2h.01M12 12.2h.01M15.6 12.2h.01" strokeWidth="2.6" />
      </>
    ),
  },
  {
    key: "transparent",
    title: "Transparent",
    body: "See which guidelines we used and how recommendations are connected.",
    icon: (
      <>
        <path d="m9.9 10.4 4.2-2.5M9.9 13.6l4.2 2.5M9.4 12H5.8" />
        <circle cx="12" cy="12" r="2.5" />
        <circle cx="16.4" cy="6.9" r="2.1" />
        <circle cx="16.4" cy="17.1" r="2.1" />
        <circle cx="4.4" cy="12" r="2.1" />
      </>
    ),
  },
];

export default function TrustCards() {
  return (
    <div className="trust-cards">
      {CARDS.map((card) => (
        <div className="trust-card" key={card.key}>
          <span className="trust-disc" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {card.icon}
            </svg>
          </span>
          <div className="trust-text">
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
