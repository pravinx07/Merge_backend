import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Successfully fetched users:', users.length);
  } catch (error) {
    console.error('PRISMA ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
