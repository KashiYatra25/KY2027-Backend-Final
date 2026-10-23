/**
 * Pass seed data for Kashiyatra'27
 * Run with: pnpm seed:passes
 */

const IMAGEKIT_BASE = "https://ik.imagekit.io/bi3ktgt58";

export const passesData = [
  {
    slug: "yatri",
    name: "Yatri Pass",
    price: 2399,
    image: `${IMAGEKIT_BASE}/passes/yatri-pass.png`,
    tagline: "Begin Your Journey",
    accentColor: "#1A5F7A", // Ganga blue
    glowColor: "rgba(26, 95, 122, 0.5)",
    popular: false,
    active: true,
    sortOrder: 0,
    benefits: [
      { text: "Welcome Kit (T-shirt + Toiletries)", highlight: false },
      { text: "Campus Tour", highlight: false },
      { text: "All Events Entry", highlight: false },
      { text: "Pro-Nite Entries", highlight: false },
    ],
    details: [
      {
        icon: "🎁",
        title: "Welcome Kit",
        description: "A festival welcome kit including a T-shirt and toiletries.",
      },
      {
        icon: "🏛️",
        title: "Campus Tour",
        description: "A guided tour of the historic IIT (BHU) campus.",
      },
      {
        icon: "🎭",
        title: "Events Entry",
        description: "Entry to all festival events.",
      },
      {
        icon: "🎤",
        title: "Pro-Nite Entries",
        description: "Access to all the Pro-Nite performances.",
      },
    ],
  },
  {
    slug: "darbar",
    name: "Darbar Pass",
    price: 2699,
    image: `${IMAGEKIT_BASE}/passes/darbar-pass.png`,
    tagline: "The Royal Experience",
    accentColor: "#D4A853", // Gold
    glowColor: "rgba(212, 168, 83, 0.5)",
    popular: true,
    active: true,
    sortOrder: 1,
    benefits: [
      { text: "Accommodation", highlight: true },
      { text: "Welcome Kit (T-shirt + Toiletries)", highlight: false },
      { text: "Campus Tour", highlight: false },
      { text: "All Events Entry", highlight: false },
      { text: "Pro-Nite Entries", highlight: false },
    ],
    details: [
      {
        icon: "🏨",
        title: "Accommodation",
        description: "Stay arranged for the festival duration.",
      },
      {
        icon: "🎁",
        title: "Welcome Kit",
        description: "A festival welcome kit including a T-shirt and toiletries.",
      },
      {
        icon: "🏛️",
        title: "Campus Tour",
        description: "A guided tour of the historic IIT (BHU) campus.",
      },
      {
        icon: "🎭",
        title: "Events Entry",
        description: "Entry to all festival events.",
      },
      {
        icon: "🎤",
        title: "Pro-Nite Entries",
        description: "Access to all the Pro-Nite performances.",
      },
    ],
  },
  {
    slug: "swarnim",
    name: "Swarnim Pass",
    price: 2999,
    image: `${IMAGEKIT_BASE}/passes/swarnim-pass.png`,
    tagline: "The Divine Experience",
    accentColor: "#FFD700", // Bright gold
    glowColor: "rgba(255, 215, 0, 0.5)",
    popular: false,
    active: true,
    sortOrder: 2,
    benefits: [
      { text: "Accommodation", highlight: true },
      { text: "Food", highlight: true },
      { text: "Welcome Kit (T-shirt + Toiletries)", highlight: false },
      { text: "Campus Tour", highlight: false },
      { text: "All Events Entry", highlight: false },
      { text: "Pro-Nite Entries", highlight: false },
    ],
    details: [
      {
        icon: "🏨",
        title: "Accommodation",
        description: "Stay arranged for the festival duration.",
      },
      {
        icon: "🍽️",
        title: "Food",
        description: "Meals included for the festival duration.",
      },
      {
        icon: "🎁",
        title: "Welcome Kit",
        description: "A festival welcome kit including a T-shirt and toiletries.",
      },
      {
        icon: "🏛️",
        title: "Campus Tour",
        description: "A guided tour of the historic IIT (BHU) campus.",
      },
      {
        icon: "🎭",
        title: "Events Entry",
        description: "Entry to all festival events.",
      },
      {
        icon: "🎤",
        title: "Pro-Nite Entries",
        description: "Access to all the Pro-Nite performances.",
      },
    ],
  },
];
