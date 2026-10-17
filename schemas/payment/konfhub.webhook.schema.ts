/**
 * KonfHub Webhook Types
 * 
 * Note: We use manual parsing in the handler instead of Zod validation
 * because KonfHub payloads can vary and we want to accept and log
 * webhooks even if some fields are missing/different.
 * 
 * This file contains type definitions for reference only.
 */

/**
 * KonfHub webhook event types we handle
 */
export const KONFHUB_EVENT_TYPES = [
  "registration",
  "cancel",
  "check_in",
  "check_out",
] as const;

export type KonfHubEventType = (typeof KONFHUB_EVENT_TYPES)[number];

/**
 * Expected structure of KonfHub webhook payload (for reference)
 * 
 * {
 *   "Id": "uuid",
 *   "Module": "attendees",
 *   "Event Type": "registration" | "cancel" | "check_in" | "check_out",
 *   "Event At": 1234567890000,
 *   "Data": {
 *     "Attendee Details": {
 *       "Name": "John Doe",
 *       "Email Address": "john@example.com",
 *       "Phone Number": "+919876543210",
 *       "KY_ID": "KY-2027-XXXXXXXX",
 *       "Booking Id": "abc123",
 *       "Ticket Details": {
 *         "Ticket Name": "Yatri Pass",
 *         "Ticket Price": 500
 *       },
 *       "Amount Details": {
 *         "Amount Paid": 590,
 *         "Currency": "INR"
 *       },
 *       "Ticket URL": "https://...",
 *       "Invoice URL": "https://...",
 *       ...
 *     }
 *   }
 * }
 */
export interface KonfHubWebhookPayload {
  Id: string;
  Module: string;
  "Event Type": string;
  "Event At": number;
  Data: {
    "Attendee Details": Record<string, unknown>;
  };
}
