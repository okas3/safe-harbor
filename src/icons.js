// Hand-drawn line icons, one per category, chosen for what the
// category means rather than as generic decoration. All share the
// same 24x24 stroke style so they read as one consistent set — the
// ship's instruments on the wall, not a stock icon pack.
const svg = (inner) => `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
       stroke-linecap="round" stroke-linejoin="round">${inner}</svg>
`;

export const CATEGORY_ICONS = {
  // Compass: a fixed reference point, unmoved by the weather around it.
  "Who God Is": svg(`
    <circle cx="12" cy="12" r="8.5"/>
    <polygon points="12,7.5 13.8,12 12,16.5 10.2,12" fill="currentColor" stroke="none"/>
  `),
  // Storm cloud with rain: the weight and fallout of sin.
  "Our Unrighteousness": svg(`
    <path d="M6.5 15a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.4 1.8A3.8 3.8 0 0 1 16.5 16H7Z"/>
    <line x1="8.5" y1="18.5" x2="8.5" y2="20.5"/>
    <line x1="12" y1="18.5" x2="12" y2="21"/>
    <line x1="15.5" y1="18.5" x2="15.5" y2="20.5"/>
  `),
  // Lighthouse: the guiding light held out to a wreck.
  "God's Mercy": svg(`
    <path d="M9.5 21 10.3 8.5h3.4L14.5 21Z"/>
    <rect x="10" y="5" width="4" height="3.5"/>
    <line x1="12" y1="2" x2="12" y2="4"/>
    <line x1="7.5" y1="5.5" x2="9" y2="6.5"/>
    <line x1="16.5" y1="5.5" x2="15" y2="6.5"/>
    <line x1="7" y1="21" x2="17" y2="21"/>
  `),
  // Lightning: raw, outstretched-arm power.
  "God's Power": svg(`
    <polygon points="13,2.5 5,14 10.8,14 9,21.5 19,10 12.5,10" fill="currentColor" stroke="none"/>
  `),
  // Ship's wheel: steering the conversation, hands on the helm.
  "Power of Prayer": svg(`
    <circle cx="12" cy="12" r="7.5"/>
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>
    <line x1="12" y1="4.5" x2="12" y2="7.7"/>
    <line x1="12" y1="16.3" x2="12" y2="19.5"/>
    <line x1="4.5" y1="12" x2="7.7" y2="12"/>
    <line x1="16.3" y1="12" x2="19.5" y2="12"/>
    <line x1="6.9" y1="6.9" x2="9.1" y2="9.1"/>
    <line x1="14.9" y1="14.9" x2="17.1" y2="17.1"/>
    <line x1="6.9" y1="17.1" x2="9.1" y2="14.9"/>
    <line x1="14.9" y1="9.1" x2="17.1" y2="6.9"/>
  `),
  // Sail catching the wind: faith as substance of things unseen.
  "Power of Faith": svg(`
    <line x1="7" y1="21" x2="7" y2="3"/>
    <path d="M7 4.5 18 11.5 7 15Z" fill="currentColor" stroke="none"/>
    <line x1="3.5" y1="21" x2="10.5" y2="21"/>
  `),
  // Sunrise over the water: a mind made new with the day.
  "Renewal of the Mind": svg(`
    <path d="M5.5 14.5a6.5 6.5 0 0 1 13 0"/>
    <line x1="12" y1="4" x2="12" y2="6.3"/>
    <line x1="5" y1="9" x2="6.6" y2="10.4"/>
    <line x1="19" y1="9" x2="17.4" y2="10.4"/>
    <path d="M2.5 17.5q2-2 4-0.2t4 0t4 -0.2t4 0.4"/>
    <path d="M2.5 20.5q2-2 4-0.2t4 0t4 -0.2t4 0.4"/>
  `),
  // Two braced supports holding a crossbar steady: Aaron and Hur
  // holding up Moses' hands until sunset — support, not rescue.
  "Bearing One Another Up": svg(`
    <line x1="8" y1="8" x2="16" y2="8"/>
    <line x1="12" y1="3" x2="12" y2="8"/>
    <line x1="4" y1="21" x2="10.3" y2="8"/>
    <line x1="20" y1="21" x2="13.7" y2="8"/>
  `),
  // A single heading arrow, not a fork: your own next step, not a
  // comparison to someone else's path. "You follow me."
  "Your Own Calling": svg(`
    <line x1="12" y1="20" x2="12" y2="4.5"/>
    <polyline points="7.5,9 12,4 16.5,9"/>
  `),
  // An open eye: Hagar naming God "El Roi" — the God who sees — in
  // the one place she felt most invisible.
  "Being Seen": svg(`
    <path d="M3 12q4-6.5 9-6.5t9 6.5q-4 6.5-9 6.5T3 12Z"/>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>
  `),
  // A jar that keeps giving: the widow's flour and oil, spent down
  // and refilled a day at a time rather than all at once up front.
  "God's Provision": svg(`
    <path d="M9 3.5h6"/>
    <path d="M10 3.5v3.2L7.5 10a4 4 0 0 0-1 2.6V19a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-6.4a4 4 0 0 0-1-2.6L14 6.7V3.5"/>
    <line x1="7" y1="15" x2="17" y2="15"/>
  `),
  // Two hands, released rather than clenched: Joseph choosing not to
  // let someone's wrong intent be the final word.
  "Forgiveness": svg(`
    <path d="M4 14q0-3 2.5-3c1.6 0 2 1 3.5 1s2-1.2 3-1.2 1.8 0.7 3 0.7c2 0 4 1 4 3.5"/>
    <path d="M4 14v3a2 2 0 0 0 2 2h1"/>
    <path d="M20 14v3a2 2 0 0 1-2 2h-1"/>
  `)
};

// The anchor flanking the page title — a drawn glyph instead of the
// ⚓ emoji, so it renders identically everywhere and matches the
// brass stroke weight of the category icons.
export const ANCHOR_ICON = svg(`
  <circle cx="12" cy="4.5" r="2"/>
  <line x1="12" y1="6.5" x2="12" y2="19"/>
  <line x1="8" y1="9.5" x2="16" y2="9.5"/>
  <path d="M5 13a7 7 0 0 0 14 0"/>
  <line x1="5" y1="13" x2="3" y2="15.3"/>
  <line x1="19" y1="13" x2="21" y2="15.3"/>
`);
