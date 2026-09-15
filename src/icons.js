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
  `)
};

// The anchor flanking the page title — a drawn glyph instead of the
// ⚓ emoji, so it renders identically everywhere and matches the
// brass stroke weight of the category icons.
export const ANCHOR_ICON = svg(`
  <circle cx="12" cy="4.5" r="2.2"/>
  <line x1="12" y1="6.7" x2="12" y2="19.5"/>
  <line x1="8.5" y1="10" x2="15.5" y2="10"/>
  <path d="M5 13a7 7 0 0 0 14 0"/>
  <line x1="5" y1="13" x2="5" y2="10.5"/>
  <line x1="19" y1="13" x2="19" y2="10.5"/>
`);
