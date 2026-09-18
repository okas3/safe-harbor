// VERSE TEXT — ESV wording, filled in from the user's own Bible/app.
export const DATA = [
  { cat: "Who God Is", verses: [
    { ref: "Exodus 3:14", text: "God said to Moses, \"I am who I am.\" And he said, \"Say this to the people of Israel: 'I am has sent me to you.'\"" },
    { ref: "Psalm 90:2", text: "Before the mountains were brought forth, or ever you had formed the earth and the world, from everlasting to everlasting you are God." },
    { ref: "Isaiah 40:28", text: "Have you not known? Have you not heard? The Lord is the everlasting God, the Creator of the ends of the earth. He does not faint or grow weary; his understanding is unsearchable." },
    { ref: "1 John 4:8", text: "Anyone who does not love does not know God, because God is love." }
  ]},
  { cat: "Our Unrighteousness", verses: [
    { ref: "Romans 3:23", text: "for all have sinned and fall short of the glory of God," },
    { ref: "Isaiah 64:6", text: "We have all become like one who is unclean, and all our righteous deeds are like a polluted garment. We all fade like a leaf, and our iniquities, like the wind, take us away." },
    { ref: "Jeremiah 17:9", text: "The heart is deceitful above all things, and desperately sick; who can understand it?" },
    { ref: "Romans 6:23", text: "For the wages of sin is death, but the free gift of God is eternal life in Christ Jesus our Lord." }
  ]},
  { cat: "God's Mercy", verses: [
    { ref: "Lamentations 3:22-23", text: "The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness." },
    { ref: "Psalm 103:10-12", text: "He does not deal with us according to our sins, nor repay us according to our iniquities. For as high as the heavens are above the earth, so great is his steadfast love toward those who fear him; as far as the east is from the west, so far does he remove our transgressions from us." },
    { ref: "Ephesians 2:4-5", text: "But God, being rich in mercy, because of the great love with which he loved us, even when we were dead in our trespasses, made us alive together with Christ—by grace you have been saved—" },
    { ref: "Titus 3:5", text: "he saved us, not because of works done by us in righteousness, but according to his own mercy, by the washing of regeneration and renewal of the Holy Spirit," },
    { ref: "John 21:17", text: "PASTE ESV TEXT — John 21:17" }
  ]},
  { cat: "God's Power", verses: [
    { ref: "Jeremiah 32:17", text: "'Ah, Lord God! It is you who have made the heavens and the earth by your great power and by your outstretched arm! Nothing is too hard for you." },
    { ref: "Ephesians 3:20", text: "Now to him who is able to do far more abundantly than all that we ask or think, according to the power at work within us," },
    { ref: "Isaiah 40:29-31", text: "He gives power to the faint, and to him who has no might he increases strength. Even youths shall faint and be weary, and young men shall fall exhausted; but they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint." }
  ]},
  { cat: "Healing", verses: [
    { ref: "James 5:14-16", text: "Is anyone among you sick? Let him call for the elders of the church, and let them pray over him, anointing him with oil in the name of the Lord. And the prayer of faith will save the one who is sick, and the Lord will raise him up. And if he has committed sins, he will be forgiven. Therefore, confess your sins to one another and pray for one another, that you may be healed. The prayer of a righteous person has great power as it is working." },
    { ref: "2 Corinthians 12:9", text: "But he said to me, \"My grace is sufficient for you, for my power is made perfect in weakness.\" Therefore I will boast all the more gladly of my weaknesses, so that the power of Christ may rest upon me." },
    { ref: "Exodus 15:26", text: "saying, \"If you will diligently listen to the voice of the Lord your God, and do that which is right in his eyes, and give ear to his commandments and keep all his statutes, I will put none of the diseases on you that I put on the Egyptians, for I am the Lord, your healer.\"" }
  ]},
  { cat: "Power of Prayer", verses: [
    { ref: "James 5:16", text: "Therefore, confess your sins to one another and pray for one another, that you may be healed. The prayer of a righteous person has great power as it is working." },
    { ref: "Philippians 4:6-7", text: "do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus." },
    { ref: "1 John 5:14-15", text: "And this is the confidence that we have toward him, that if we ask anything according to his will he hears us. And if we know that he hears us in whatever we ask, we know that we have the requests that we have asked of him." },
    { ref: "Matthew 7:7", text: "\"Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you." }
  ]},
  { cat: "Power of Faith", verses: [
    { ref: "Hebrews 11:1", text: "Now faith is the assurance of things hoped for, the conviction of things not seen." },
    { ref: "Romans 10:17", text: "So faith comes from hearing, and hearing through the word of Christ." },
    { ref: "2 Corinthians 5:7", text: "for we walk by faith, not by sight." },
    { ref: "Matthew 17:20", text: "He said to them, \"Because of your little faith. For truly, I say to you, if you have faith like a grain of mustard seed, you will say to this mountain, 'Move from here to there,' and it will move, and nothing will be impossible for you.\"" }
  ]},
  { cat: "Renewal of the Mind", verses: [
    { ref: "Romans 12:2", text: "Do not be conformed to this world, but be transformed by the renewal of your mind, that by testing you may discern what is the will of God, what is good and acceptable and perfect." },
    { ref: "Philippians 4:8", text: "Finally, brothers, whatever is true, whatever is honorable, whatever is just, whatever is pure, whatever is lovely, whatever is commendable, if there is any excellence, if there is anything worthy of praise, think about these things." },
    { ref: "2 Corinthians 10:5", text: "We destroy arguments and every lofty opinion raised against the knowledge of God, and take every thought captive to obey Christ," },
    { ref: "Colossians 3:2", text: "Set your minds on things that are above, not on things that are on earth." }
  ]},
  // Sourced from the scenario library (src/scenarios.js) rather than
  // picked up front — new categories get added here organically as
  // scenario-sourced verses don't fit any existing theme.
  { cat: "Bearing One Another Up", verses: [
    { ref: "Exodus 17:12", text: "But Moses' hands grew weary, so they took a stone and put it under him, and he sat on it, while Aaron and Hur held up his hands, one on one side, and the other on the other side. So his hands were steady until the going down of the sun." },
    { ref: "Exodus 18:18", text: "You and the people with you will certainly wear yourselves out, for the thing is too heavy for you. You are not able to do it alone." }
  ]},
  { cat: "Your Own Calling", verses: [
    { ref: "John 21:22", text: "Jesus said to him, \"If it is my will that he remain until I come, what is that to you? You follow me!\"" }
  ]},
  { cat: "Being Seen", verses: [
    { ref: "Genesis 16:13", text: "So she called the name of the Lord who spoke to her, \"You are a God of seeing,\" for she said, \"Truly here I have seen him who looks after me.\"" }
  ]},
  { cat: "God's Provision", verses: [
    { ref: "1 Kings 17:14", text: "For thus says the Lord, the God of Israel, 'The jar of flour shall not be spent, and the jug of oil shall not be empty, until the day that the Lord sends rain upon the earth.'" }
  ]},
  { cat: "Forgiveness", verses: [
    { ref: "Genesis 50:20", text: "As for you, you meant evil against me, but God meant it for good, to bring it about that many people should be kept alive, as they are today." }
  ]}
];
