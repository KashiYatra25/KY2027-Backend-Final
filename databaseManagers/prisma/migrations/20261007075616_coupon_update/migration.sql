/*
  Warnings:

  - You are about to drop the column `finalAmount` on the `CouponUsage` table. All the data in the column will be lost.
  - You are about to drop the column `originalAmount` on the `CouponUsage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CouponUsage" DROP COLUMN "finalAmount",
DROP COLUMN "originalAmount";
