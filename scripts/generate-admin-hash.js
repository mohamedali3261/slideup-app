// Script to generate bcrypt hash for admin password
// Usage: node scripts/generate-admin-hash.js YOUR_PASSWORD

import bcrypt from 'bcryptjs';

const password = process.argv[2] || '01021303309';
const saltRounds = 14; // Strong encryption for admin

console.log('\n🔐 Generating Admin Password Hash...\n');
console.log('Password:', password);
console.log('Salt Rounds:', saltRounds);
console.log('\nGenerating...\n');

const hash = bcrypt.hashSync(password, saltRounds);

console.log('✅ Hash Generated:\n');
console.log(hash);
console.log('\n📋 Copy this hash and use it in supabase-schema.sql');
console.log('Replace: $2a$14$YourHashedPasswordHere');
console.log('With:   ', hash);
console.log('\n');
