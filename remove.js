// remove-old-courses.js  —  node remove-old-courses.js
const Database = require('better-sqlite3');
const db = new Database('database.db');

const targets = [
  'Introduction to Web Development',
  'Python for Beginners',
  'UI/UX Design Fundamentals',
  'Advanced JavaScript & ES6+',
];

for (const title of targets) {
  const course = db.prepare('SELECT id FROM courses WHERE title = ?').get(title);
  if (!course) { console.log(`Not found, skipping: "${title}"`); continue; }

  const courseId = course.id;
  const lessonIds = db.prepare('SELECT id FROM lessons WHERE course_id = ?').all(courseId).map(l => l.id);

  if (lessonIds.length) {
    const ph  = lessonIds.map(() => '?').join(',');
    const aIds = db.prepare(`SELECT id FROM assignments WHERE lesson_id IN (${ph})`).all(...lessonIds).map(a => a.id);

    if (aIds.length) {
      const aph = aIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM submissions WHERE assignment_id IN (${aph})`).run(...aIds);
      db.prepare(`DELETE FROM assignments WHERE id IN (${aph})`).run(...aIds);
    }

    db.prepare(`DELETE FROM lesson_completions WHERE lesson_id IN (${ph})`).run(...lessonIds);
    db.prepare(`DELETE FROM quizzes WHERE lesson_id IN (${ph})`).run(...lessonIds);
    db.prepare(`DELETE FROM lessons WHERE course_id = ?`).run(courseId);
  }

  db.prepare('DELETE FROM enrollments WHERE course_id = ?').run(courseId);
  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
  console.log(`✅ Removed "${title}"`);
}

console.log('\nDone! Only HTML Fundamentals remains.');