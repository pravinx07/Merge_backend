/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "projects" JSONB DEFAULT '[]',
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "website" TEXT;
