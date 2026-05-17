-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activity" JSONB DEFAULT '[]',
ADD COLUMN     "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "personality" TEXT,
ADD COLUMN     "status" TEXT;
