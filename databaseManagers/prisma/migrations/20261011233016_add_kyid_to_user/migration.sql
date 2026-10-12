-- AlterTable
ALTER TABLE "User" ADD COLUMN "kyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_kyId_key" ON "User"("kyId");
