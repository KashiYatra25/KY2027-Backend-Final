-- Add isPaidUser column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPaidUser" BOOLEAN NOT NULL DEFAULT false;
