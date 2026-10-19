import type { Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";

// ═══════════════════════════════════════════════════════════════════
// GET ZONAL COLLEGES
// 
// Returns list of colleges with their events and pass info.
// This is static config data for now - could move to DB later.
// ═══════════════════════════════════════════════════════════════════

// Static college config - matches frontend config
const ZONAL_COLLEGES = [
  {
    slug: "rgipt",
    name: "Rajiv Gandhi Institute of Petroleum Technology",
    shortName: "RGIPT",
    city: "Amethi",
    state: "Uttar Pradesh",
    venue: "TBD",
    date: "2027-01-15",
    status: "registration-open",
    passes: [
      {
        type: "SINGLE_EVENT",
        price: 400,
        description: "Register for any 1 event of your choice",
      },
      {
        type: "MULTI_EVENT",
        price: 550,
        description: "Register for unlimited events",
      },
    ],
    events: [
      { slug: "solo-group-dance", name: "Solo & Group Dance", category: "DANCE" },
      { slug: "paper-costume-design", name: "Paper Costume Design", category: "ART" },
      { slug: "face-painting", name: "Face Painting", category: "ART" },
      { slug: "sketching", name: "Sketching", category: "ART" },
      { slug: "mono-act", name: "Mono Act", category: "THEATRE" },
      { slug: "mr-ms-rgipt", name: "Mr. & Ms. RGIPT", category: "PERSONALITY" },
      { slug: "nukkad-natak", name: "Nukkad Natak", category: "THEATRE" },
      { slug: "debate", name: "Debate", category: "LITERARY" },
      { slug: "quiz", name: "Quiz", category: "LITERARY" },
      { slug: "open-mic", name: "Open Mic", category: "MUSIC" },
      { slug: "solo-instrumental-music", name: "Solo Instrumental & Solo Music", category: "MUSIC" },
    ],
    prizeDistribution: {
      first: "35%",
      second: "25%",
    },
  },
];

/**
 * GET /zonals/colleges
 * Returns list of all zonal colleges with events and pass info
 */
export const getZonalColleges = catchAsync(
  async (_req: Request, res: Response): Promise<void> => {
    new OkResponseStrategy().handleResponse(res, {
      info: "Zonal colleges fetched successfully",
      colleges: ZONAL_COLLEGES,
    });
  }
);
