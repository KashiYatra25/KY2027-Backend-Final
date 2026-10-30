/**
 * Event seed data for Kashiyatra'27
 * Run with: pnpm seed:events
 */

import type { EventCategory, ParticipationType } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════════
// CATEGORY COORDINATORS
// Main coordinators for each event category (3 per category)
// ═══════════════════════════════════════════════════════════════════

type Coordinator = { name: string; phone: string };

const CATEGORY_COORDINATORS: Record<EventCategory, Coordinator[]> = {
  ABHINAY: [
    { name: "Anand Manmora", phone: "9352445131" },
    { name: "Sumit", phone: "8949328424" },
    { name: "Akash", phone: "9166343505" },
  ],
  MIRAGE: [
    { name: "Anand Manmora", phone: "9352445131" },
    { name: "Sumit", phone: "8949328424" },
    { name: "Akash", phone: "9166343505" },
  ],
  TOOLIKA: [
    { name: "Anand Manmora", phone: "9352445131" },
    { name: "Sumit", phone: "8949328424" },
    { name: "Akash", phone: "9166343505" },
  ],
  BANDISH: [
    { name: "Sagnik Maity", phone: "8078635105" },
    { name: "JSC", phone: "8309723081" },
    { name: "Shyam Sundar", phone: "9929715288" },
  ],
  CROSSWINDZ: [
    { name: "Sagnik Maity", phone: "8078635105" },
    { name: "JSC", phone: "8309723081" },
    { name: "Shyam Sundar", phone: "9929715288" },
  ],
  NATRAJ: [
    { name: "Sagnik Maity", phone: "8078635105" },
    { name: "JSC", phone: "8309723081" },
    { name: "Shyam Sundar", phone: "9929715288" },
  ],
  SAMWAAD: [
    { name: "Mourya", phone: "9356774728" },
    { name: "Jagatjyoti", phone: "8837013300" },
    { name: "Adhiraj Chandawat", phone: "9950576406" },
  ],
  ENQUIZTA: [
    { name: "Mourya", phone: "9356774728" },
    { name: "Jagatjyoti", phone: "8837013300" },
    { name: "Adhiraj Chandawat", phone: "9950576406" },
  ],
  ZAIKA: [
    { name: "Mourya", phone: "9356774728" },
    { name: "Jagatjyoti", phone: "8837013300" },
    { name: "Adhiraj Chandawat", phone: "9950576406" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// STUDENT COORDINATORS BY CATEGORY
// ═══════════════════════════════════════════════════════════════════

const STUDENT_COORDINATORS: Record<EventCategory, string[]> = {
  ABHINAY: ["Aadi", "Aniket Mahto", "Moses Vivek", "Avnish"],
  MIRAGE: ["Harshita", "Aaditya Pipara", "Gargi", "Mayank"],
  TOOLIKA: ["Gaurav", "Sanchit", "Jayesh", "Anju", "Abeer Chhabra"],
  BANDISH: ["Priyanshu Alwariya", "Anand Garwa", "Mohit Burdak", "Samar Singh Daiya", "Kartikey Chaudhary"],
  CROSSWINDZ: ["Avneet Badgujar", "Devash", "Aman", "Bhupendra"],
  NATRAJ: ["Tella Amrutha Tulasi", "Karthikeya Kampa", "Shambu", "Sayantan Mandal"],
  SAMWAAD: ["Jayad Khaitan", "Ayush Das", "Harshit Shrivastav", "Harshit Asiwal", "Rishab Ranjan"],
  ENQUIZTA: ["Hamsika", "Thanusree", "Shashank"],
  ZAIKA: [],
};

type EventSeedData = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: EventCategory;
  participationType: ParticipationType;
  minTeamSize?: number;
  maxTeamSize?: number;
  registrationOpen: boolean;
  rules: string[];
  prizePool?: string;
  venue?: string;
  coordinators?: Coordinator[];
  studentCoordinators?: string[];
};

// Helper to add coordinators to event data
function withCoordinators(event: Omit<EventSeedData, 'coordinators' | 'studentCoordinators'>): EventSeedData {
  return {
    ...event,
    coordinators: CATEGORY_COORDINATORS[event.category],
    studentCoordinators: STUDENT_COORDINATORS[event.category],
  };
}

export const eventsData: EventSeedData[] = [
  // ═══════════════════════════════════════════════════════════════════
  // NATRAJ - Dance Events
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "cut-a-rug",
    name: "Cut-a-Rug",
    tagline: "Solo Dance Battle",
    description:
      "Showcase your individual dance prowess in this electrifying solo competition. Any dance form, any style - just you and the stage.",
    category: "NATRAJ",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 3-5 minutes",
      "Any dance form allowed",
      "Participants must bring their own music (USB/aux)",
      "Props allowed but not mandatory",
      "Vulgarity will lead to disqualification",
    ],
    prizePool: "₹25,000",
    venue: "Main Stage",
  }),
  withCoordinators({
    slug: "sync-or-sink",
    name: "Sync or Sink",
    tagline: "Duo Dance Showdown",
    description:
      "Two dancers, one rhythm. Show the world what perfect synchronization looks like in this duo dance competition.",
    category: "NATRAJ",
    participationType: "DUO",
    minTeamSize: 2,
    maxTeamSize: 2,
    registrationOpen: true,
    rules: [
      "Performance time: 4-6 minutes",
      "Exactly 2 participants per team",
      "Any dance form allowed",
      "Props allowed",
      "Lifts and stunts at own risk",
    ],
    prizePool: "₹30,000",
    venue: "Main Stage",
  }),
  withCoordinators({
    slug: "footloose",
    name: "Footloose",
    tagline: "Group Dance Competition",
    description:
      "Bring your crew and set the stage on fire! The ultimate group dance competition where coordination meets creativity.",
    category: "NATRAJ",
    participationType: "TEAM",
    minTeamSize: 6,
    maxTeamSize: 15,
    registrationOpen: true,
    rules: [
      "Performance time: 6-10 minutes",
      "Team size: 6-15 members",
      "Mix of dance forms encouraged",
      "Props and costumes allowed",
      "Stage setup time: 2 minutes max",
    ],
    prizePool: "₹50,000",
    venue: "Main Stage",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // CROSSWINDZ - Music Events
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "sur-sangam",
    name: "Sur Sangam",
    tagline: "Solo Singing",
    description:
      "Let your voice be the instrument. Classical, Bollywood, Western - showcase your vocal talent in this solo singing competition.",
    category: "CROSSWINDZ",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 4-6 minutes",
      "Any genre allowed",
      "Karaoke track or self-accompaniment allowed",
      "Original compositions get bonus points",
      "No lip-syncing",
    ],
    prizePool: "₹20,000",
    venue: "Amphitheatre",
  }),
  withCoordinators({
    slug: "battle-of-bands",
    name: "Battle of Bands",
    tagline: "Rock the Stage",
    description:
      "Assemble your band and compete for glory! Original compositions and covers welcome in this epic battle of musical talent.",
    category: "CROSSWINDZ",
    participationType: "TEAM",
    minTeamSize: 3,
    maxTeamSize: 8,
    registrationOpen: true,
    rules: [
      "Performance time: 10-15 minutes",
      "Band size: 3-8 members",
      "At least one original composition mandatory",
      "Basic equipment provided, special instruments to be brought",
      "Sound check: 10 minutes before performance",
    ],
    prizePool: "₹60,000",
    venue: "Main Stage",
  }),
  withCoordinators({
    slug: "instrumental-solo",
    name: "Instrumental Solo",
    tagline: "Strings, Keys & Beats",
    description:
      "From guitars to tablas, pianos to flutes - showcase your mastery over your instrument in this solo instrumental competition.",
    category: "CROSSWINDZ",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 5-8 minutes",
      "Any instrument allowed",
      "Participants must bring their own instruments",
      "Backing tracks allowed for enhancement",
      "Fusion pieces encouraged",
    ],
    prizePool: "₹15,000",
    venue: "Amphitheatre",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // BANDISH - Classical Events
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "raag-rang",
    name: "Raag Rang",
    tagline: "Classical Vocal",
    description:
      "Dive into the depths of Indian classical music. Hindustani or Carnatic - let the ragas flow through your voice.",
    category: "BANDISH",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 10-15 minutes",
      "Hindustani or Carnatic allowed",
      "Accompanists allowed (not judged)",
      "Raga to be announced before performance",
      "Traditional attire recommended",
    ],
    prizePool: "₹25,000",
    venue: "Takshila Auditorium",
  }),
  withCoordinators({
    slug: "taal-vadya",
    name: "Taal Vadya",
    tagline: "Classical Instrumental",
    description:
      "The timeless sounds of classical instruments. Sitar, tabla, veena, sarangi - let tradition speak through your fingers.",
    category: "BANDISH",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 10-15 minutes",
      "Classical instruments only",
      "Accompanists allowed",
      "Brief introduction of piece required",
      "Traditional attire recommended",
    ],
    prizePool: "₹25,000",
    venue: "Takshila Auditorium",
  }),
  withCoordinators({
    slug: "nritya-natya",
    name: "Nritya Natya",
    tagline: "Classical Dance",
    description:
      "Bharatanatyam, Kathak, Odissi, Kuchipudi - celebrate the rich heritage of Indian classical dance forms.",
    category: "BANDISH",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 8-12 minutes",
      "Any recognized classical form",
      "Traditional costume mandatory",
      "Live or recorded music allowed",
      "Brief description of piece required",
    ],
    prizePool: "₹25,000",
    venue: "Takshila Auditorium",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ABHINAY - Drama & Theatre
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "nukkad-natak",
    name: "Nukkad Natak",
    tagline: "Street Play",
    description:
      "Theatre without boundaries. Take your message to the streets with powerful performances that move the masses.",
    category: "ABHINAY",
    participationType: "TEAM",
    minTeamSize: 8,
    maxTeamSize: 20,
    registrationOpen: true,
    rules: [
      "Performance time: 15-25 minutes",
      "Team size: 8-20 members",
      "Social message mandatory",
      "No vulgar content",
      "Props must be portable",
      "No mics - projection skills required",
    ],
    prizePool: "₹40,000",
    venue: "Open Ground",
  }),
  withCoordinators({
    slug: "stage-play",
    name: "Stage Play",
    tagline: "Theatre Production",
    description:
      "The grandeur of stage theatre. Drama, comedy, tragedy - bring your scripts to life on the big stage.",
    category: "ABHINAY",
    participationType: "TEAM",
    minTeamSize: 5,
    maxTeamSize: 15,
    registrationOpen: true,
    rules: [
      "Performance time: 30-45 minutes",
      "Team size: 5-15 members",
      "Original or adapted scripts",
      "Stage setup time: 5 minutes",
      "Technical requirements to be submitted in advance",
    ],
    prizePool: "₹50,000",
    venue: "Auditorium",
  }),
  withCoordinators({
    slug: "mono-act",
    name: "Mono Act",
    tagline: "One Person Show",
    description:
      "One actor, infinite possibilities. Showcase your range and versatility in this solo acting competition.",
    category: "ABHINAY",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 5-10 minutes",
      "Any theme/genre",
      "Minimal props allowed",
      "Character transitions encouraged",
      "Original content preferred",
    ],
    prizePool: "₹15,000",
    venue: "Mini Auditorium",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // MIRAGE - Fashion & Lifestyle
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "runway-revolution",
    name: "Runway Revolution",
    tagline: "Fashion Show",
    description:
      "Strut your stuff on the runway! Design, style, and walk - the complete fashion experience.",
    category: "MIRAGE",
    participationType: "TEAM",
    minTeamSize: 8,
    maxTeamSize: 16,
    registrationOpen: true,
    rules: [
      "Performance time: 12-18 minutes",
      "Team size: 8-16 members",
      "Theme-based rounds",
      "Original designs get bonus points",
      "Music and choreography included",
    ],
    prizePool: "₹60,000",
    venue: "Main Stage",
  }),
  withCoordinators({
    slug: "mr-and-ms-ky",
    name: "Mr. & Ms. KY",
    tagline: "Personality Contest",
    description:
      "Brains, beauty, and talent combined. Compete for the prestigious title of Mr. & Ms. Kashiyatra.",
    category: "MIRAGE",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Multiple rounds over 2 days",
      "Rounds: Introduction, Talent, Q&A, Ramp Walk",
      "Open to all genders",
      "Formal attire for finale",
      "Age limit: 18-25 years",
    ],
    prizePool: "₹30,000",
    venue: "Main Stage",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TOOLIKA - Art & Design
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "canvas-clash",
    name: "Canvas Clash",
    tagline: "Painting Competition",
    description:
      "Express yourself through colors and strokes. On-spot painting competition with surprise themes.",
    category: "TOOLIKA",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Duration: 3 hours",
      "Theme revealed on spot",
      "Canvas provided (24x30 inches)",
      "Bring your own paints and brushes",
      "Any medium: acrylic, oil, watercolor",
    ],
    prizePool: "₹15,000",
    venue: "Art Gallery",
  }),
  withCoordinators({
    slug: "sketch-storm",
    name: "Sketch Storm",
    tagline: "Speed Sketching",
    description:
      "Quick thinking, quicker hands. Capture the essence in minutes with your sketching skills.",
    category: "TOOLIKA",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Duration: 1 hour",
      "Multiple quick rounds",
      "Pencil/charcoal only",
      "Paper provided",
      "No digital tools",
    ],
    prizePool: "₹10,000",
    venue: "Art Gallery",
  }),
  withCoordinators({
    slug: "digital-dreams",
    name: "Digital Dreams",
    tagline: "Digital Art Competition",
    description:
      "Pixels and imagination collide. Create stunning digital artwork in this modern art competition.",
    category: "TOOLIKA",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Duration: 4 hours",
      "Bring your own device/tablet",
      "Any software allowed",
      "Theme given on spot",
      "Submit in PNG/PSD format",
    ],
    prizePool: "₹15,000",
    venue: "Computer Lab",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ENQUIZTA - Quiz & Knowledge
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "general-quiz",
    name: "General Quiz",
    tagline: "Test Your Knowledge",
    description:
      "From history to pop culture, science to sports - the ultimate test of general knowledge.",
    category: "ENQUIZTA",
    participationType: "DUO",
    minTeamSize: 2,
    maxTeamSize: 2,
    registrationOpen: true,
    rules: [
      "Team of 2",
      "Prelims: Written round",
      "Finals: Buzzer round",
      "No electronic devices",
      "Quizmaster's decision is final",
    ],
    prizePool: "₹20,000",
    venue: "Seminar Hall",
  }),
  withCoordinators({
    slug: "tech-trivia",
    name: "Tech Trivia",
    tagline: "Geek Out",
    description:
      "For the tech enthusiasts. Coding, gadgets, startups, and everything technology.",
    category: "ENQUIZTA",
    participationType: "DUO",
    minTeamSize: 2,
    maxTeamSize: 2,
    registrationOpen: true,
    rules: [
      "Team of 2",
      "Topics: CS, Tech News, Startups, Gadgets",
      "Coding round included",
      "Laptops needed for some rounds",
      "Prelims + Finals format",
    ],
    prizePool: "₹20,000",
    venue: "Computer Lab",
  }),
  withCoordinators({
    slug: "biz-quiz",
    name: "Biz Quiz",
    tagline: "Business & Finance",
    description:
      "Stocks, startups, and strategies. Test your business acumen in this commerce quiz.",
    category: "ENQUIZTA",
    participationType: "DUO",
    minTeamSize: 2,
    maxTeamSize: 2,
    registrationOpen: true,
    rules: [
      "Team of 2",
      "Topics: Business, Finance, Economics, Marketing",
      "Case study round included",
      "Prelims + Finals format",
      "No MBA students allowed",
    ],
    prizePool: "₹20,000",
    venue: "Seminar Hall",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // SAMWAAD - Literary Events
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "debate",
    name: "Debate",
    tagline: "Battle of Words",
    description:
      "Argue, convince, win. The classic debate competition testing your oratory and reasoning skills.",
    category: "SAMWAAD",
    participationType: "DUO",
    minTeamSize: 2,
    maxTeamSize: 2,
    registrationOpen: true,
    rules: [
      "Team of 2 (For and Against)",
      "Topics given 30 minutes before",
      "Speaking time: 5 minutes each",
      "Rebuttal: 2 minutes",
      "English or Hindi",
    ],
    prizePool: "₹15,000",
    venue: "Seminar Hall",
  }),
  withCoordinators({
    slug: "poetry-slam",
    name: "Poetry Slam",
    tagline: "Verses & Voices",
    description:
      "Spoken word, shayari, or free verse - let your poetry move hearts and minds.",
    category: "SAMWAAD",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Performance time: 3-5 minutes",
      "Original content only",
      "Any language allowed",
      "No props or music",
      "Memorization preferred",
    ],
    prizePool: "₹10,000",
    venue: "Open Mic Stage",
  }),
  withCoordinators({
    slug: "creative-writing",
    name: "Creative Writing",
    tagline: "Pen Your Imagination",
    description:
      "Fiction, non-fiction, or something in between. Let your creativity flow through words.",
    category: "SAMWAAD",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Duration: 2 hours",
      "Topic given on spot",
      "Word limit: 1000-1500 words",
      "English or Hindi",
      "Handwritten only",
    ],
    prizePool: "₹10,000",
    venue: "Seminar Hall",
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ZAIKA - Food & Culinary
  // ═══════════════════════════════════════════════════════════════════
  withCoordinators({
    slug: "masterchef-ky",
    name: "MasterChef KY",
    tagline: "Cooking Competition",
    description:
      "Fire up the stoves! Show off your culinary skills in this intense cooking competition.",
    category: "ZAIKA",
    participationType: "DUO",
    minTeamSize: 2,
    maxTeamSize: 2,
    registrationOpen: true,
    rules: [
      "Team of 2",
      "Duration: 90 minutes",
      "Ingredients provided (mystery basket)",
      "Taste, presentation, creativity judged",
      "Basic equipment provided",
    ],
    prizePool: "₹20,000",
    venue: "Food Court",
  }),
  withCoordinators({
    slug: "mocktail-madness",
    name: "Mocktail Madness",
    tagline: "Mix & Shake",
    description:
      "Create the perfect blend of flavors. Non-alcoholic cocktail mixing competition.",
    category: "ZAIKA",
    participationType: "INDIVIDUAL",
    registrationOpen: true,
    rules: [
      "Duration: 30 minutes",
      "Create 2 mocktails",
      "Ingredients provided",
      "Presentation matters",
      "Flair bartending bonus points",
    ],
    prizePool: "₹10,000",
    venue: "Food Court",
  }),
];
