// ═══════════════════════════════════════════════════════════════════
// KONFHUB WEBHOOK TYPES
// Types for payment webhook controllers
// ═══════════════════════════════════════════════════════════════════

/**
 * Pass tier identifiers
 */
export type PassTier = "darbar" | "swarnim" | "yatri";

/**
 * Attendee data extracted from KonfHub webhook
 */
export interface KonfHubAttendee {
  bookingId: string;
  name: string;
  email: string;
  phone: string | null;
  kyId: string | null;
  ticketName: string;
  ticketPrice: number;
  amountPaid: number;
  currency: string;
  paymentId: string | null;
  ticketUrl: string | null;
  invoiceUrl: string | null;
  teamName: string | null;
  parentBookingId: string | null;
  buyerEmail: string | null;
}

/**
 * Attendee data for zonal events webhook
 */
export interface ZonalAttendee {
  bookingId: string;
  name: string;
  email: string;
  phone: string | null;
  ticketName: string;
  ticketPrice: number;
  amountPaid: number;
  currency: string;
  paymentId: string | null;
  ticketUrl: string | null;
  invoiceUrl: string | null;
  parentBookingId: string | null;
  buyerEmail: string | null;
}
