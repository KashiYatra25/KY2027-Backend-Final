-- CreateTable
CREATE TABLE "AccountSuspension" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suspendedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suspendedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountSuspension_userId_idx" ON "AccountSuspension"("userId");

-- CreateIndex
CREATE INDEX "AccountSuspension_suspendedBy_idx" ON "AccountSuspension"("suspendedBy");

-- AddForeignKey
ALTER TABLE "AccountSuspension" ADD CONSTRAINT "AccountSuspension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSuspension" ADD CONSTRAINT "AccountSuspension_suspendedBy_fkey" FOREIGN KEY ("suspendedBy") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
