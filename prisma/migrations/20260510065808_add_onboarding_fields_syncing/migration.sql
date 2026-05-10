-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
