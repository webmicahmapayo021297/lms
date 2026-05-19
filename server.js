// server.js
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(session({ secret: 'lms-secret', resave: false, saveUninitialized: false }));

// ─────────────────────────────────────────
// Auth
// ─────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);
  res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email);
  if (user && await bcrypt.compare(req.body.password, user.password)) {
    req.session.user = user;
    res.json({ success: true, role: user.role });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.user.id);
  res.json(user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ─────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}

function requireTeacher(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  if (req.session.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher access required' });
  next();
}

// ─────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────

function recalcProgress(userId, courseId) {
  const { count: total } = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?').get(courseId);
  const { count: done }  = db.prepare(`
    SELECT COUNT(*) as count FROM lesson_completions lc
    JOIN lessons l ON lc.lesson_id = l.id
    WHERE lc.user_id = ? AND l.course_id = ?
  `).get(userId, courseId);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  db.prepare('UPDATE enrollments SET progress = ? WHERE user_id = ? AND course_id = ?').run(progress, userId, courseId);
  return progress;
}

function annotateUnlock(userId, lessons) {
  const completedIds = new Set(
    db.prepare('SELECT lesson_id FROM lesson_completions WHERE user_id = ?').all(userId).map(r => r.lesson_id)
  );
  const passedMajorLessonIds = new Set(
    db.prepare(`
      SELECT s.lesson_id FROM submissions s
      WHERE s.user_id = ? AND s.is_major = 1 AND s.status = 'passed'
    `).all(userId).map(r => r.lesson_id)
  );

  lessons.forEach((l, i) => {
    l.completed = completedIds.has(l.id);
    if (i === 0) {
      l.unlocked = true;
    } else {
      const prev = lessons[i - 1];
      const prevDone = completedIds.has(prev.id);
      if (!prevDone) {
        l.unlocked = false;
      } else if (prev.is_major_assignment) {
        l.unlocked = passedMajorLessonIds.has(prev.id);
      } else {
        l.unlocked = true;
      }
    }
  });
  return lessons;
}

// ─────────────────────────────────────────
// Courses (student-facing)
// ─────────────────────────────────────────

app.get('/api/courses', (req, res) => {
  res.json(db.prepare('SELECT * FROM courses').all());
});

app.get('/api/enrollments', requireAuth, (req, res) => {
  const enrollments = db.prepare(`
    SELECT c.id, c.title, c.description, e.progress
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.user_id = ?
  `).all(req.session.user.id);
  res.json(enrollments);
});

app.post('/api/courses/:id/enroll', requireAuth, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)')
    .run(req.session.user.id, req.params.id);
  res.json({ success: true });
});

// ─────────────────────────────────────────
// Teacher — Course CRUD
// ─────────────────────────────────────────

app.get('/api/teacher/courses', requireTeacher, (req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY id DESC').all();
  res.json(courses);
});

app.get('/api/teacher/stats', requireTeacher, (req, res) => {
  const { total_courses } = db.prepare('SELECT COUNT(*) AS total_courses FROM courses').get();
  const { total_lessons  } = db.prepare('SELECT COUNT(*) AS total_lessons  FROM lessons').get();
  const { students       } = db.prepare("SELECT COUNT(DISTINCT user_id) AS students FROM enrollments").get();
  const { drafts } = db.prepare("SELECT COUNT(*) AS drafts FROM courses WHERE status = 'draft'").get();
  res.json({ total_courses, total_lessons, students, drafts });
});

app.post('/api/teacher/courses', requireTeacher, (req, res) => {
  const { title, description, status = 'draft' } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const result = db.prepare('INSERT INTO courses (title, description, status) VALUES (?, ?, ?)')
    .run(title.trim(), description?.trim() || null, status);
  res.status(201).json(db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/teacher/courses/:id', requireTeacher, (req, res) => {
  const { title, description, status } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  db.prepare('UPDATE courses SET title = ?, description = ?, status = ? WHERE id = ?')
    .run(title.trim(), description?.trim() || null, status || 'draft', req.params.id);
  res.json(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
});

app.delete('/api/teacher/courses/:id', requireTeacher, (req, res) => {
  const courseId = req.params.id;
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const lessonIds = db.prepare('SELECT id FROM lessons WHERE course_id = ?').all(courseId).map(l => l.id);
  if (lessonIds.length) {
    const ph = lessonIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM lesson_completions WHERE lesson_id IN (${ph})`).run(...lessonIds);
    db.prepare(`DELETE FROM submissions WHERE lesson_id IN (${ph})`).run(...lessonIds);
    db.prepare(`DELETE FROM quizzes WHERE lesson_id IN (${ph})`).run(...lessonIds);
    db.prepare(`DELETE FROM lessons WHERE course_id = ?`).run(courseId);
  }
  db.prepare('DELETE FROM enrollments WHERE course_id = ?').run(courseId);
  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
  res.json({ success: true });
});

// ─────────────────────────────────────────
// Teacher — Lesson CRUD
// ─────────────────────────────────────────

app.post('/api/courses/:id/lessons', requireTeacher, (req, res) => {
  const courseId = req.params.id;
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const { title, description, duration, content, code_example, is_major_assignment = 0, module_number = 1 } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const { max_order } = db.prepare('SELECT COALESCE(MAX(order_num), 0) AS max_order FROM lessons WHERE course_id = ?').get(courseId);
  const result = db.prepare(`
    INSERT INTO lessons (course_id, title, content, code_example, order_num, is_major_assignment, module_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(courseId, title.trim(), content?.trim() || description?.trim() || null, code_example?.trim() || null, max_order + 1, is_major_assignment ? 1 : 0, module_number);
  res.status(201).json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/teacher/lessons/:id', requireTeacher, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const { title, description, content, code_example, order_num, is_major_assignment, module_number } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  db.prepare(`UPDATE lessons SET title=?, content=?, code_example=?, order_num=?, is_major_assignment=?, module_number=? WHERE id=?`)
    .run(title.trim(), content?.trim() || description?.trim() || lesson.content, code_example?.trim() ?? lesson.code_example, order_num ?? lesson.order_num, is_major_assignment != null ? (is_major_assignment ? 1 : 0) : lesson.is_major_assignment, module_number ?? lesson.module_number, req.params.id);
  res.json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id));
});

app.delete('/api/teacher/lessons/:id', requireTeacher, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  db.prepare('DELETE FROM lesson_completions WHERE lesson_id = ?').run(lesson.id);
  db.prepare('DELETE FROM submissions WHERE lesson_id = ?').run(lesson.id);
  db.prepare('DELETE FROM quizzes WHERE lesson_id = ?').run(lesson.id);
  db.prepare('DELETE FROM lessons WHERE id = ?').run(lesson.id);
  const siblings = db.prepare('SELECT id FROM lessons WHERE course_id = ? ORDER BY order_num').all(lesson.course_id);
  const reorder = db.prepare('UPDATE lessons SET order_num = ? WHERE id = ?');
  siblings.forEach((s, i) => reorder.run(i + 1, s.id));
  res.json({ success: true });
});

app.put('/api/teacher/courses/:id/lessons/reorder', requireTeacher, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  const update = db.prepare('UPDATE lessons SET order_num = ? WHERE id = ? AND course_id = ?');
  db.transaction(() => order.forEach((id, i) => update.run(i + 1, id, req.params.id)))();
  res.json({ success: true });
});

app.get('/api/teacher/lessons/:id', requireTeacher, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  res.json(lesson);
});

// ─────────────────────────────────────────
// Lessons (student-facing)
// ─────────────────────────────────────────

app.get('/api/courses/:id/lessons', (req, res) => {
  const lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num').all(req.params.id);
  if (req.session.user) annotateUnlock(req.session.user.id, lessons);
  res.json(lessons);
});

app.get('/api/lessons/:id', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const all = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num').all(lesson.course_id);
  annotateUnlock(userId, all);
  const idx = all.findIndex(l => l.id === lesson.id);
  Object.assign(lesson, { completed: all[idx].completed, unlocked: all[idx].unlocked, prev_id: idx > 0 ? all[idx-1].id : null, next_id: idx < all.length-1 ? all[idx+1].id : null });
  res.json(lesson);
});

app.post('/api/lessons/:id/complete', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const lessonId = parseInt(req.params.id);
  const lesson = db.prepare('SELECT course_id FROM lessons WHERE id = ?').get(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  db.prepare('INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)').run(userId, lessonId);
  const progress = recalcProgress(userId, lesson.course_id);
  res.json({ success: true, progress });
});

app.post('/api/lessons/:id/uncomplete', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const lessonId = parseInt(req.params.id);
  const lesson = db.prepare('SELECT course_id FROM lessons WHERE id = ?').get(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  db.prepare('DELETE FROM lesson_completions WHERE user_id = ? AND lesson_id = ?').run(userId, lessonId);
  const progress = recalcProgress(userId, lesson.course_id);
  res.json({ success: true, progress });
});

// GET /api/lessons/:id/progress — returns passed interactive block indices for state restore
app.get('/api/lessons/:id/progress', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT interactive_index, exercise_index, answer_index, passed
    FROM exercise_attempts
    WHERE user_id = ? AND lesson_id = ? AND passed = 1
    ORDER BY interactive_index ASC
  `).all(req.session.user.id, req.params.id);
  res.json(rows);
});

// GET /api/lessons/:id/submissions — existing assignment submissions for a lesson
app.get('/api/lessons/:id/submissions', requireAuth, (req, res) => {
  const subs = db.prepare(`
    SELECT * FROM submissions
    WHERE user_id = ? AND lesson_id = ?
    ORDER BY assignment_index ASC
  `).all(req.session.user.id, req.params.id);
  res.json(subs);
});

// POST /api/exercises/check — log exercise/challenge attempt, restore-friendly
app.post('/api/exercises/check', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { lesson_id, exercise_index, interactive_index, answer_index, passed } = req.body;

  if (passed) {
    db.prepare(`
      INSERT INTO exercise_attempts
        (user_id, lesson_id, exercise_index, interactive_index, answer_index, passed, attempted_at)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, lesson_id, interactive_index)
      DO UPDATE SET answer_index=excluded.answer_index, passed=1, attempted_at=CURRENT_TIMESTAMP
    `).run(userId, lesson_id, exercise_index ?? 0, interactive_index ?? exercise_index ?? 0, answer_index ?? 0);

    // Auto-complete lesson if all interactives now passed
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lesson_id);
    if (lesson) {
      let content = {};
      try { content = JSON.parse(lesson.content || '{}'); } catch (_) {}
      const totalInteractive = (content.blocks || []).filter(b =>
        ['exercise', 'challenge', 'assignment'].includes(b.type)
      ).length;
      if (totalInteractive > 0) {
        const { cnt } = db.prepare(`
          SELECT COUNT(*) as cnt FROM exercise_attempts
          WHERE user_id = ? AND lesson_id = ? AND passed = 1
        `).get(userId, lesson_id);
        if (cnt >= totalInteractive) {
          db.prepare('INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)').run(userId, lesson_id);
          recalcProgress(userId, lesson.course_id);
        }
      }
    }
  }
  res.json({ success: true });
});

// ─────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────

// POST /api/submissions/major — student submits an inline assignment block
app.post('/api/submissions/major', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { lesson_id, assignment_index, code, submission_type } = req.body;
  if (!lesson_id) return res.status(400).json({ error: 'lesson_id required' });

  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lesson_id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  let content = {};
  try { content = JSON.parse(lesson.content || '{}'); } catch (_) {}
  const asgnBlocks = (content.blocks || []).filter(b => b.type === 'assignment');
  const asIdx = assignment_index ?? 0;
  const block = asgnBlocks[asIdx];
  if (!block) return res.status(404).json({ error: 'Assignment block not found' });

  const existing = db.prepare(`
    SELECT * FROM submissions WHERE user_id = ? AND lesson_id = ? AND assignment_index = ?
  `).get(userId, lesson_id, asIdx);

  if (existing) {
    db.prepare(`UPDATE submissions SET code=?, status='pending', submitted_at=CURRENT_TIMESTAMP,
      resubmission_count=resubmission_count+1, feedback=NULL WHERE id=?`).run(code, existing.id);
    return res.json({ id: existing.id, status: 'pending' });
  }

  const result = db.prepare(`
    INSERT INTO submissions
      (user_id, lesson_id, assignment_index, code, submission_type, status, is_major,
       submitted_at, assignment_title, points, requirements)
    VALUES (?, ?, ?, ?, ?, 'pending', 1, CURRENT_TIMESTAMP, ?, ?, ?)
  `).run(userId, lesson_id, asIdx, code, submission_type || block.submissionType || 'code',
    block.assignmentTitle || 'Assignment', block.points || 100, JSON.stringify(block.requirements || []));

  res.json({ id: result.lastInsertRowid, status: 'pending' });
});

// POST /api/submissions/:id/resubmit
app.post('/api/submissions/:id/resubmit', requireAuth, (req, res) => {
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.user.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  if (sub.status !== 'needs_revision') return res.status(400).json({ error: 'Cannot resubmit' });
  db.prepare(`UPDATE submissions SET code=?, status='pending', submitted_at=CURRENT_TIMESTAMP,
    resubmission_count=resubmission_count+1, feedback=NULL WHERE id=?`).run(req.body.code, sub.id);
  res.json({ success: true });
});

// PUT /api/submissions/:id/review
app.put('/api/submissions/:id/review', requireTeacher, (req, res) => {
  const { verdict, feedback, requirement_grades, score } = req.body;
  if (!['passed', 'needs_revision'].includes(verdict)) return res.status(400).json({ error: 'Invalid verdict' });
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  db.prepare(`UPDATE submissions SET status=?, feedback=?, requirement_grades=?, score=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(verdict, feedback || null, JSON.stringify(requirement_grades || []), score || null, sub.id);

  if (verdict === 'passed' && sub.lesson_id) {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(sub.lesson_id);
    if (lesson) {
      db.prepare('INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)').run(sub.user_id, sub.lesson_id);
      recalcProgress(sub.user_id, lesson.course_id);
    }
  }
  res.json({ success: true });
});

// GET /api/teacher/major-assignments
app.get('/api/teacher/major-assignments', requireTeacher, (req, res) => {
  const filter = req.query.filter || 'pending';
  let where = 's.is_major = 1';
  if (filter !== 'all') where += ` AND s.status = '${filter}'`;

  const rows = db.prepare(`
    SELECT s.*,
      u.name AS student_name,
      c.title AS course_title
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN lessons l ON l.id = s.lesson_id
    JOIN courses c ON c.id = l.course_id
    WHERE ${where}
    ORDER BY s.submitted_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/submissions/:id/messages', requireAuth, (req, res) => {
  res.json(db.prepare(`
    SELECT m.*, u.name AS sender_name, u.id AS sender_id FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.submission_id = ? ORDER BY m.sent_at
  `).all(req.params.id));
});

app.post('/api/submissions/:id/message', requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  const sub = db.prepare('SELECT id FROM submissions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  db.prepare('INSERT INTO messages (submission_id, sender_id, body) VALUES (?, ?, ?)').run(sub.id, req.session.user.id, body.trim());
  res.json({ success: true });
});

app.listen(3000, () => console.log('LMS running at http://localhost:3000'));