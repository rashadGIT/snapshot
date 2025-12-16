/**
 * Migration script: Convert single role to roles array + activeRole
 * Run before schema update
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateRoles() {
  console.log('Starting role migration...');

  // Get all users with a role
  const users = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
    SELECT id, role FROM users WHERE role IS NOT NULL
  `;

  console.log(`Found ${users.length} users with roles to migrate`);

  for (const user of users) {
    console.log(`Migrating user ${user.id}: ${user.role} -> [${user.role}] (active: ${user.role})`);

    // Update user with new schema
    await prisma.$executeRaw`
      UPDATE users
      SET roles = ARRAY[${user.role}::"UserRole"],
          "activeRole" = ${user.role}::"UserRole"
      WHERE id = ${user.id}
    `;
  }

  console.log('Migration complete!');
}

migrateRoles()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
