"use client";

import Link from "next/link";

const INCLUDED = [
  ["Game-day photography", "Full coverage, start to final whistle."],
  ["Warmups", "The quiet stuff before the crowd shows up."],
  ["Action shots", "Every player on the roster, not just the stars."],
  ["Celebrations", "Goal calls, bench reactions, the pile-on."],
  ["Goalies", "Properly covered, not an afterthought."],
  ["Team photos", "Posed group shots, on the bench or on the ice."],
  ["Social-media-ready images", "Sized and cropped for posting."],
  ["Fast delivery", "Gallery up within a few days of the game."],
];

export default function TeamsPage() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">For teams</p>
          <h1>
            Team
            <br />
            photography.
          </h1>
          <p className="lede">
            Bring me out for a game and your whole roster gets covered — not
            just whoever happens to be near the puck.
          </p>
          <div className="hero-meta">
            <span>Hockey</span>
            <span>Soccer</span>
            <span>Football</span>
            <span>Basketball</span>
          </div>
          <div>
            <Link href="/contact" className="btn accent">
              Book your team
            </Link>
          </div>
        </div>
      </section>

      <section className="section team-section">
        <div className="wrap">
          <p className="eyebrow">What your team gets</p>
          <h2 style={{ marginBottom: 40 }}>Everything, covered</h2>

          <ul className="offer-grid">
            {INCLUDED.map(([title, detail]) => (
              <li key={title} className="offer-item">
                <span className="offer-check" aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <span className="muted small">{detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="team-cta">
            <p className="muted" style={{ margin: 0 }}>
              Around Midland and the rest of Simcoe County. Tell me the date and
              the rink and I will get back to you.
            </p>
            <Link href="/contact" className="btn accent">
              Book your team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
