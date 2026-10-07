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
      { text: "Event Entry Only", highlight: false },
      { text: "All Cultural Events", highlight: false },
      { text: "IIT BHU Campus Access", highlight: false },
      { text: "Festival Merchandise (Basic)", highlight: false },
    ],
    details: [
      {
        icon: "🎤",
        title: "Pro Nights Entry",
        description: "Exclusive access to all professional artist performances and star nights",
      },
      {
        icon: "🎁",
        title: "Welcome Kit",
        description: "Festival welcome kit with essentials, ID card, and exclusive Kashi Yatra merchandise",
      },
      {
        icon: "🏛️",
        title: "Campus Tour",
        description: "Free guided tour of the historic IIT BHU campus and its heritage buildings",
      },
      {
        icon: "🎭",
        title: "All Cultural Events",
        description: "Entry to all cultural performances, competitions, and exhibitions",
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
      { text: "All Yatri Benefits", highlight: true },
      { text: "Pro-Night Shows Access", highlight: false },
      { text: "Priority Seating", highlight: false },
      { text: "Exclusive Workshops", highlight: false },
      { text: "Festival Kit", highlight: false },
    ],
    details: [
      {
        icon: "🍽️",
        title: "Complimentary Meals",
        description: "Free food throughout the festival - breakfast, lunch, and dinner included",
      },
      {
        icon: "🎤",
        title: "Pro Nights Entry",
        description: "Premium access to all professional artist performances with priority seating",
      },
      {
        icon: "🏛️",
        title: "Campus Tour",
        description: "Free guided tour with exclusive backstage access to event venues",
      },
      {
        icon: "🎁",
        title: "Premium Festival Kit",
        description: "Exclusive Darbar kit with premium merchandise, souvenirs, and memorabilia",
      },
      {
        icon: "🎯",
        title: "Priority Registration",
        description: "Skip the queues with priority registration for all competitions and workshops",
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
      { text: "All Darbar Benefits", highlight: true },
      { text: "VIP Lounge Access", highlight: false },
      { text: "Front Row Seating", highlight: false },
      { text: "Meet & Greet with Artists", highlight: false },
      { text: "Premium Merch Kit", highlight: false },
      { text: "Complimentary Refreshments", highlight: false },
    ],
    details: [
      {
        icon: "🏨",
        title: "Free Accommodation",
        description: "Comfortable stay in IIT BHU hostels for the entire festival duration",
      },
      {
        icon: "🍽️",
        title: "All Meals Included",
        description: "Premium dining experience with all meals and refreshments covered",
      },
      {
        icon: "👑",
        title: "VIP Lounge Access",
        description: "Exclusive access to the VIP lounge with premium amenities and refreshments",
      },
      {
        icon: "🎤",
        title: "Front Row + Meet & Greet",
        description: "Front row seating at all events plus exclusive meet & greet with performing artists",
      },
      {
        icon: "🎁",
        title: "Swarnim Premium Kit",
        description: "Ultimate festival kit with limited edition merchandise and exclusive collectibles",
      },
      {
        icon: "🚗",
        title: "Airport/Station Pickup",
        description: "Complimentary pickup and drop service from Varanasi airport/railway station",
      },
    ],
  },
];
