// A situation can resonate with more than one passage — connections
// is an array so a second valid scripture can be added to an existing
// situation later without changing the shape. `scene` is narrative
// context only (never memorized); `ref`'s actual verse text is what
// gets drilled in By Heart mode. `whyAnalogical` exists so the
// connection is never presented as a literal 1:1 command — it's a
// derived, structural correlation, not "the Bible's official answer."
export const SCENARIOS = [
  {
    situation: "Your boss was acting in a way you felt wasn't right. You talked to your mom about it, and she didn't reach for a verse about confronting wrongdoing or authority directly — she went to Aaron and Hur, the picture of holding someone up through their weariness so they don't fail at a critical moment.",
    connections: [
      {
        ref: "Exodus 17:12",
        scene: "Israel is at war with Amalek. As long as Moses holds his staff/hands up, Israel wins; when his arms tire and drop, Amalek starts winning. Aaron and Hur don't fight the battle for him — they sit Moses down, and each holds up one of his hands until sunset, so his hands stay steady until victory.",
        whyAnalogical: "There's no boss, no battle, no staff in the actual text. The connection is structural — a person in a taxing position of responsibility, at risk of faltering, and someone else's role being support rather than critique or takeover."
      }
    ]
  },
  {
    situation: "You're carrying way more than you can actually handle at work — approving every decision, answering every question, the bottleneck for everything — and you're starting to burn out but keep telling yourself it has to be this way.",
    connections: [
      {
        ref: "Exodus 18:18",
        scene: "Moses is single-handedly judging every dispute for the entire nation of Israel, sunrise to sundown. His father-in-law Jethro watches this and tells him plainly he's going to wear himself out, and the people too, because the load is too heavy for one man — then proposes appointing capable people under him to handle smaller matters, saving Moses for what only he can do.",
        whyAnalogical: "There's no workplace, no org chart, no approvals queue in the text. The structural match is a leader mistaking 'it all has to go through me' for faithfulness, when the actual problem is an unsustainable load that needs real delegation, not more personal endurance."
      }
    ]
  },
  {
    situation: "You're watching someone else's life or career go a different, easier-looking way than yours, and you keep asking why things worked out for them and not for you.",
    connections: [
      {
        ref: "John 21:22",
        scene: "Jesus has just told Peter, plainly, the hard way his own life is going to end. Peter's response is to point at John and ask, 'what about him?' Jesus doesn't explain John's path or compare the two callings — he tells Peter that whatever happens to John is not Peter's business, and the only instruction that matters is 'you follow me.'",
        whyAnalogical: "No career, no peer comparison, no visible 'easier path' in the text itself. The structural match is redirecting a comparison question, 'why not me like them,' back to the only thing actually in front of you, your own next faithful step, rather than an explanation of the disparity."
      }
    ]
  },
  {
    situation: "You feel completely overlooked — like the people around you don't notice what you're going through, or don't notice you at all.",
    connections: [
      {
        ref: "Genesis 16:13",
        scene: "Hagar, pregnant and mistreated, has fled alone into the wilderness with nothing. An angel of the Lord finds her there, speaks to her directly, and gives her a promise. Her response afterward is to name God 'El Roi' — the God who sees — because she realizes she was seen in the one place she felt most invisible and abandoned.",
        whyAnalogical: "No wilderness, no pregnancy, no literal exile in your situation. The structural match is the specific feeling of being unseen by the people who should notice, and the claim being made isn't that circumstances instantly change, but that being unseen by people isn't the same as being unseen, period."
      }
    ]
  },
  {
    situation: "Money's tight, and you're anxious day to day about whether there's going to be enough — for you, or for people depending on you.",
    connections: [
      {
        ref: "1 Kings 17:14",
        scene: "During a famine, Elijah tells a widow with almost nothing left, one handful of flour, a little oil, meant to be her last meal before she and her son starve, to make him bread first anyway. She does it. The text says the flour and oil don't run out for the rest of the famine — but only after she acted while it still looked like there wasn't enough.",
        whyAnalogical: "No famine, no prophet at your door. The structural match is scarcity that has to be acted through, not resolved first — provision that shows up as 'enough for today, again tomorrow,' not a lump sum that removes the anxiety in advance."
      }
    ]
  },
  {
    situation: "Someone close to you did something that really hurt you — badly, over a long time — and you're trying to figure out what it even looks like to be at peace with them now.",
    connections: [
      {
        ref: "Genesis 50:20",
        scene: "Joseph's own brothers sold him into slavery out of jealousy, and he spent years in prison and hard circumstances because of it. Years later, with all the power to punish them, he instead tells them directly: what you meant for evil, God meant for good, to save many lives — and he provides for them.",
        whyAnalogical: "No slavery, no famine, no reversal-of-fortune power dynamic in most modern hurt. The structural match is holding both things at once without pretending the harm wasn't real: someone's wrong intent, and a refusal to let that be the final word on how you treat them now."
      }
    ]
  },
  {
    situation: "You did something you're genuinely ashamed of, and part of you feels disqualified now — like you don't get to be trusted with anything meaningful anymore.",
    connections: [
      {
        ref: "John 21:17",
        scene: "Peter denied even knowing Jesus three times, at the exact moment it mattered most. After the resurrection, Jesus doesn't lecture him about it — he asks him three times, once for each denial, 'do you love me,' and each time follows the answer with the same instruction: feed my sheep. Real responsibility, handed back on purpose.",
        whyAnalogical: "No public denial, no three-times structure in most failures. The structural match is a specific, named failure being met not with disqualification but with responsibility handed back directly — restoration that goes through the failure honestly rather than around it."
      }
    ]
  }
];

// Match mode needs a real pool to mismatch against — below this, every
// pairing would be a guaranteed first guess, which isn't a game.
export const SCENARIO_MATCH_MIN = 3;
