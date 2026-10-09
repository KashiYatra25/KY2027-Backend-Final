-- AlterTable
ALTER TABLE "CaApplication" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referredAt" TIMESTAMP(3),
ADD COLUMN     "referredByCaId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByCaId_fkey" FOREIGN KEY ("referredByCaId") REFERENCES "CaProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
