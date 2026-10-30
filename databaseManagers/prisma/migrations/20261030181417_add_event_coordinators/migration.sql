-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "coordinators" JSONB,
ADD COLUMN     "studentCoordinators" TEXT[] DEFAULT ARRAY[]::TEXT[];
