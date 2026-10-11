import type { AadhaarData } from "@services/textract/helper/types/textract.types.js";
import { logger } from "@logger/logger.js";
import { AADHAAR_REGEX, DOB_PATTERNS, GENDER_PATTERNS, NAME_EXCLUSIONS } from "@services/textract/helper/constants/aadhaar.constants.js";

// ═══════════════════════════════════════════════════════════════════
// VERHOEFF CHECKSUM ALGORITHM FOR AADHAAR VALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Verhoeff multiplication table
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/**
 * Verhoeff permutation table
 */
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates an Aadhaar number using the Verhoeff checksum algorithm
 * @param aadhaarNumber - 12-digit Aadhaar number (with or without spaces)
 * @returns true if valid, false otherwise
 */
function isValidAadhaarChecksum(aadhaarNumber: string): boolean {
  // Remove spaces and validate length
  const digits = aadhaarNumber.replace(/\s/g, "");
  
  if (digits.length !== 12) return false;
  if (!/^\d{12}$/.test(digits)) return false;
  
  // Aadhaar cannot start with 0 or 1
  if (digits[0] === "0" || digits[0] === "1") return false;
  
  // Apply Verhoeff algorithm
  let checksum = 0;
  const reversedDigits = digits.split("").reverse();
  
  for (let i = 0; i < reversedDigits.length; i++) {
    const digit = parseInt(reversedDigits[i]!, 10);
    const pIndex = i % 8;
    const pValue = VERHOEFF_P[pIndex]![digit]!;
    checksum = VERHOEFF_D[checksum]![pValue]!;
  }
  
  // Valid if checksum is 0
  return checksum === 0;
}

/**
 * Extract Aadhaar number from text lines and validate it
 */
function extractAadhaarNumber(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = line.match(AADHAAR_REGEX);
    if (match?.[1]) {
      const aadhaarNumber = match[1].replace(/\s/g, "");
      
      // Validate using Verhoeff checksum
      if (isValidAadhaarChecksum(aadhaarNumber)) {
        logger.debug("Aadhaar passed Verhoeff validation", { aadhaarLast4: aadhaarNumber.slice(-4) });
        return aadhaarNumber;
      } else {
        logger.debug("Aadhaar failed Verhoeff validation — skipping", { aadhaarLast4: aadhaarNumber.slice(-4) });
      }
    }
  }
  return undefined;
}

/**
 * Extract date of birth from text lines
 */
function extractDateOfBirth(lines: string[]): string | undefined {
  const fullText = lines.join(" ");

  for (const pattern of DOB_PATTERNS) {
    const match = fullText.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Extract gender from text lines
 */
function extractGender(lines: string[]): "MALE" | "FEMALE" | "OTHER" | undefined {
  const fullText = lines.join(" ");

  for (const pattern of GENDER_PATTERNS.MALE) {
    if (pattern.test(fullText)) {
      return "MALE";
    }
  }

  for (const pattern of GENDER_PATTERNS.FEMALE) {
    if (pattern.test(fullText)) {
      return "FEMALE";
    }
  }

  return undefined;
}

/**
 * Check if line contains excluded words (headers, labels, etc.)
 */
function containsExcludedWord(line: string): boolean {
  const lowerLine = line.toLowerCase();
  for (const exclusion of NAME_EXCLUSIONS) {
    if (lowerLine.includes(exclusion.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Check if line is a date pattern
 */
function isDateLine(line: string): boolean {
  return /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(line) || 
         /dob|birth|जन्म|तिथि/i.test(line);
}

/**
 * Check if line is a gender line
 */
function isGenderLine(line: string): boolean {
  return /\bmale\b|\bfemale\b|पुरुष|महिला|स्त्री/i.test(line);
}

/**
 * Check if line is mostly Hindi characters
 */
function isHindiLine(line: string): boolean {
  const hindiChars = (line.match(/[\u0900-\u097F]/g) || []).length;
  return hindiChars > line.replace(/\s/g, "").length * 0.5;
}

/**
 * Check if line looks like an English name
 * Handles: Title Case, ALL CAPS, Mixed Case, Transliterated names
 */
function isEnglishNameLine(line: string): boolean {
  const trimmed = line.trim();
  
  // Must have at least 2 characters
  if (trimmed.length < 2) return false;
  
  // Should be mostly letters (allow some spaces)
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const nonSpaceLength = trimmed.replace(/\s/g, "").length;
  if (nonSpaceLength === 0) return false;
  if (letterCount < nonSpaceLength * 0.7) return false; // Relaxed from 0.8 to 0.7
  
  // Should not have numbers
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount > 0) return false;
  
  // Should not have special characters (except spaces, dots, apostrophes)
  if (/[^a-zA-Z\s.''-]/.test(trimmed)) return false;
  
  // Split into words
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0 || words.length > 5) return false;
  
  // Each word should start with a letter and be at least 1 char
  for (const word of words) {
    if (!/^[a-zA-Z]/.test(word)) return false;
  }
  
  return true;
}

/**
 * Normalize name to Title Case for consistency
 */
function normalizeNameCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Calculate name quality score
 * Higher score = more likely to be the actual name
 */
function calculateNameScore(line: string, index: number, dobLineIndex: number, genderLineIndex: number): number {
  let score = 0;
  const trimmed = line.trim();
  const words = trimmed.split(/\s+/);
  
  // === Position-based scoring ===
  
  // Prefer lines after headers (index >= 2)
  if (index >= 2) score += 10;
  if (index >= 3) score += 5;
  
  // Prefer lines closer to DOB (name is usually 1-2 lines before DOB)
  if (dobLineIndex !== -1) {
    if (index === dobLineIndex - 1) score += 25;
    if (index === dobLineIndex - 2) score += 20;
    if (index === dobLineIndex - 3) score += 10;
  }
  
  // Also consider gender line position
  if (genderLineIndex !== -1) {
    if (index === genderLineIndex - 1) score += 15;
    if (index === genderLineIndex - 2) score += 20;
    if (index === genderLineIndex - 3) score += 10;
  }
  
  // === Format-based scoring ===
  
  // Title Case (e.g., "Shashank Raj") - highest confidence
  if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed)) {
    score += 20;
  }
  // ALL CAPS (e.g., "SHASHANK RAJ") - common in official documents
  else if (/^[A-Z]+(\s+[A-Z]+)*$/.test(trimmed)) {
    score += 18;
  }
  // Mixed case starting with caps (e.g., "SHASHANK Raj", "Shashank RAJ")
  else if (/^[A-Z]/.test(trimmed)) {
    score += 15;
  }
  // Any other valid format
  else {
    score += 10;
  }
  
  // === Word count scoring ===
  
  // Indian names typically have 2-4 words
  if (words.length === 2) score += 10;      // Most common: First Last
  else if (words.length === 3) score += 8;  // First Middle Last
  else if (words.length === 4) score += 5;  // First Middle Middle Last
  else if (words.length === 1) score += 3;  // Single name (less common but valid)
  
  // === Length scoring ===
  
  // Names are typically 5-30 characters
  const len = trimmed.length;
  if (len >= 5 && len <= 30) score += 5;
  if (len >= 8 && len <= 25) score += 3; // Sweet spot
  
  // === Common Indian name patterns ===
  
  // Check for common Indian name endings/patterns
  const lowerTrimmed = trimmed.toLowerCase();
  const commonPatterns = [
    /kumar/i, /singh/i, /raj/i, /sharma/i, /gupta/i, /verma/i,
    /yadav/i, /pandey/i, /mishra/i, /tiwari/i, /dubey/i,
    /jha/i, /srivastava/i, /saxena/i, /agarwal/i, /jain/i,
    /patel/i, /shah/i, /mehta/i, /khan/i, /ansari/i,
    /das/i, /roy/i, /dey/i, /sen/i, /bose/i,
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(lowerTrimmed)) {
      score += 5;
      break; // Only add once
    }
  }
  
  return score;
}

/**
 * Extract name from Aadhaar card text lines
 * 
 * Aadhaar card structure (typical):
 * 1. भारत सरकार (Hindi header)
 * 2. Government of India (English header)
 * 3. Hindi Name (e.g., शशांक राज)
 * 4. English Name (e.g., Shashank Raj) <-- THIS IS WHAT WE WANT
 * 5. जन्म तिथि / DOB : DD/MM/YYYY
 * 6. पुरुष / Male (or महिला / Female)
 * 7. Aadhaar number
 * 
 * Strategy:
 * 1. Find the DOB line index
 * 2. Look at lines BEFORE DOB that are valid English names
 * 3. Skip headers, Hindi text, and other noise
 * 4. Score candidates based on position, format, and patterns
 */
function extractName(lines: string[]): string | undefined {
  // First, log rawText for debugging
  logger.debug("Textract raw lines", { lineCount: lines.length, lines });
  
  // Find DOB line index (name appears before this)
  let dobLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isDateLine(lines[i]!)) {
      dobLineIndex = i;
      break;
    }
  }
  
  // Find Gender line index (name appears before this too)
  let genderLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isGenderLine(lines[i]!)) {
      genderLineIndex = i;
      break;
    }
  }
  
  // Determine the upper bound for name search
  // Name should appear before DOB and Gender
  let upperBound = lines.length;
  if (dobLineIndex !== -1) upperBound = Math.min(upperBound, dobLineIndex);
  if (genderLineIndex !== -1) upperBound = Math.min(upperBound, genderLineIndex);
  
  // Collect candidate English name lines
  const candidates: { line: string; index: number; score: number }[] = [];
  
  for (let i = 0; i < upperBound; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    
    // Skip excluded words (Government, India, etc.)
    if (containsExcludedWord(line)) continue;
    
    // Skip Hindi lines (we want English name)
    if (isHindiLine(line)) continue;
    
    // Skip date/gender lines
    if (isDateLine(line) || isGenderLine(line)) continue;
    
    // Check if it looks like an English name
    if (isEnglishNameLine(line)) {
      const score = calculateNameScore(line, i, dobLineIndex, genderLineIndex);
      candidates.push({ line, index: i, score });
    }
  }
  
  logger.debug("Name candidates with scores", { candidates });
  
  // Sort by score descending and return best match
  candidates.sort((a, b) => b.score - a.score);
  
  if (candidates.length > 0) {
    const bestMatch = candidates[0]!.line;
    // Normalize to Title Case for consistency
    return normalizeNameCase(bestMatch);
  }
  
  // Fallback: Look for "To:" pattern (common in e-Aadhaar)
  for (const line of lines) {
    if (!line) continue;
    if (/^To\s*[:\-]?\s*/i.test(line)) {
      const nameAfterTo = line.replace(/^To\s*[:\-]?\s*/i, "").trim();
      if (nameAfterTo && isEnglishNameLine(nameAfterTo)) {
        return normalizeNameCase(nameAfterTo);
      }
    }
  }
  
  return undefined;
}

/**
 * Parse Aadhaar card text and extract relevant fields
 */
export function parseAadhaarData(textLines: string[]): AadhaarData {
  return {
    name: extractName(textLines),
    aadhaarNumber: extractAadhaarNumber(textLines),
    gender: extractGender(textLines),
    dateOfBirth: extractDateOfBirth(textLines),
    rawText: textLines,
  };
}
