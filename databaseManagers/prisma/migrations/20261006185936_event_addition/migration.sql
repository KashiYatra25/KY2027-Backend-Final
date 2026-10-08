-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('NATRAJ', 'CROSSWINDZ', 'BANDISH', 'ABHINAY', 'MIRAGE', 'TOOLIKA', 'ENQUIZTA', 'SAMWAAD', 'ZAIKA');

-- CreateEnum
CREATE TYPE "ParticipationType" AS ENUM ('INDIVIDUAL', 'DUO', 'TEAM');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "participationType" "ParticipationType" NOT NULL,
    "minTeamSize" INTEGER,
    "maxTeamSize" INTEGER,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prizePool" TEXT,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "maxParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
