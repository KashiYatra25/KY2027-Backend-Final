/**
 * Verified user data from Google ID token
 */
export interface VerifiedGoogleUser {
  /** Google's unique user ID (sub claim) */
  id: string;
  /** Verified email address */
  email: string;
  /** Whether email is verified by Google */
  emailVerified: boolean;
  /** User's display name */
  name: string | null;
  /** User's first name */
  givenName: string | null;
  /** User's last name */
  familyName: string | null;
  /** Profile picture URL */
  picture: string | null;
  /** Host domain (for Google Workspace accounts) */
  hostedDomain: string | null;
}
