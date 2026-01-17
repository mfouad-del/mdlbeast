import bcrypt from "bcrypt"

/**
 * Script to generate bcrypt hashed passwords
 * Usage: npx ts-node src/scripts/generate-password.ts
 */

async function generatePasswords() {
  const passwords = [
    { username: process.env.SUPER_ADMIN_EMAIL || "admin@mdlbeast.com", password: process.env.SUPER_ADMIN_PASSWORD || "admin123" },
    { username: process.env.TEST_USER_EMAIL || "user@mdlbeast.com", password: process.env.TEST_USER_PASSWORD || "user123" },
  ]

  console.log("\n🔐 Generated Bcrypt Password Hashes:\n")

  for (const { username, password } of passwords) {
    const hash = await bcrypt.hash(password, 10)
    console.log(`Username: ${username}`)
    console.log(`Password: ${password}`)
    console.log(`Hash: ${hash}\n`)
  }
}

generatePasswords().catch(console.error)
