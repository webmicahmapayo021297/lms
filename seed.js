// seed-users.js  —  node seed-users.js
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const db = new Database('database.db');

const hash = bcrypt.hashSync('password123', 10);

const users = [
  { name: 'Ms. Garcia',   email: 'garcia@school.com',  role: 'teacher' },
  { name: 'Mr. Santos',   email: 'santos@school.com',  role: 'teacher' },
  { name: 'Alice Reyes',  email: 'alice@student.com',  role: 'student' },
  { name: 'Ben Cruz',     email: 'ben@student.com',    role: 'student' },
  { name: 'Clara Diaz',   email: 'clara@student.com',  role: 'student' },
  { name: 'David Lim',    email: 'david@student.com',  role: 'student' },
  { name: 'Eva Mendoza',  email: 'eva@student.com',    role: 'student' },
  { name: 'Frank Torres', email: 'frank@student.com',  role: 'student' },
];

for (const u of users) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  if (existing) { console.log(`Already exists, skipping: ${u.email}`); continue; }
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(u.name, u.email, hash, u.role);
  console.log(`✅ Added: ${u.email} (${u.role})`);
}

console.log('\nAll passwords: password123');