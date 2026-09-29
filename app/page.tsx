import Link from "next/link";
import SignalPinMark from "@/components/SignalPinMark";

export default function PublicHomePage() {
  return (
    <main className="public-home">
      <header className="public-home-header">
        <Link href="/" className="public-home-brand" aria-label="RecMap home">
          <SignalPinMark size={40} />
          <span>
            <strong>RecMap</strong>
          </span>
        </Link>
        <Link href="/login" className="public-home-login">Sign in</Link>
      </header>

      <section className="public-home-hero">
        <div className="public-home-hero-inner">
          <div className="public-home-copy">
            <p className="public-home-kicker">RecMap</p>
            <h1>Discover what clinical guidance says about AI.</h1>
            <p className="public-home-intro">
              Search trustworthy clinical guidance and explore the evidence behind recommendations in plain language.
            </p>
            <p></p>
            <Link href="/ask" className="public-home-button">Enter RecMap <span aria-hidden="true">→</span></Link>
          </div>
          <div className="public-home-photo" role="img" aria-label="Healthcare professionals reviewing clinical information together" />
        </div>
      </section>

      <section className="public-home-belief">
        <p className="public-home-kicker">Trustworthy guidance for AI and healthcare</p>
        <h2>Helping people make better decisions about AI in care.</h2>
        <p>
          RecMap brings together AI-related recommendations from clinical practice guidelines so clinicians,
          researchers, guideline developers, and health leaders can see what is known, where recommendations
          differ, and which questions still need better answers.
        </p>
      </section>

      <footer className="public-home-footer">
        <div className="public-home-footer-brand">REC<span>MAP</span></div>
        <nav aria-label="Footer navigation">
          <Link href="/ask">Enter RecMap</Link>
          <Link href="/about">About</Link>
          <Link href="mailto:info@magicevidence.org">Contact</Link>
        </nav>
        <small>Part of the MAGIC Evidence Ecosystem Foundation</small>
      </footer>
    </main>
  );
}
