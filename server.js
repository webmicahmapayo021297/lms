require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(session({ secret: 'lms-secret', resave: false, saveUninitialized: false }));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const run = async (sql, args = []) => {
  return await db.execute({ sql, args });
};

const all = async (sql, args = []) => {
  const result = await db.execute({ sql, args });
  return result.rows;
};

const get = async (sql, args = []) => {
  const result = await db.execute({ sql, args });
  return result.rows[0] || null;
};

// ─────────────────────────────────────────
// Auth
// ─────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE email = ?', [req.body.email]);
    if (user && await bcrypt.compare(req.body.password, user.password)) {
      req.session.user = user;
      res.json({ success: true, role: user.role });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  try {
    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [req.session.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

async function recalcProgress(userId, courseId) {
  const totalRow = await get('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?', [courseId]);
  const doneRow = await get(`
    SELECT COUNT(*) as count FROM lesson_completions lc
    JOIN lessons l ON lc.lesson_id = l.id
    WHERE lc.user_id = ? AND l.course_id = ?
  `, [userId, courseId]);
  const total = totalRow?.count || 0;
  const done = doneRow?.count || 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  await run('UPDATE enrollments SET progress = ? WHERE user_id = ? AND course_id = ?', [progress, userId, courseId]);
  return progress;
}

async function annotateUnlock(userId, lessons) {
  const completedRows = await all('SELECT lesson_id FROM lesson_completions WHERE user_id = ?', [userId]);
  const completedIds = new Set(completedRows.map(r => r.lesson_id));

  const passedRows = await all(`
    SELECT s.lesson_id FROM submissions s
    WHERE s.user_id = ? AND s.is_major = 1 AND s.status = 'passed'
  `, [userId]);
  const passedMajorLessonIds = new Set(passedRows.map(r => r.lesson_id));

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

app.get('/api/courses', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM courses'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/enrollments', requireAuth, async (req, res) => {
  try {
    const enrollments = await all(`
      SELECT c.id, c.title, c.description, e.progress
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?
    `, [req.session.user.id]);
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/courses/:id/enroll', requireAuth, async (req, res) => {
  try {
    await run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [req.session.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// Teacher — Course CRUD
// ─────────────────────────────────────────

app.get('/api/teacher/courses', requireTeacher, async (req, res) => {
  try {
    res.json(await all('SELECT * FROM courses ORDER BY id DESC'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teacher/stats', requireTeacher, async (req, res) => {
  try {
    const r1 = await get('SELECT COUNT(*) AS total_courses FROM courses');
    const r2 = await get('SELECT COUNT(*) AS total_lessons FROM lessons');
    const r3 = await get('SELECT COUNT(DISTINCT user_id) AS students FROM enrollments');
    const r4 = await get("SELECT COUNT(*) AS drafts FROM courses WHERE status = 'draft'");
    res.json({
      total_courses: r1?.total_courses || 0,
      total_lessons: r2?.total_lessons || 0,
      students: r3?.students || 0,
      drafts: r4?.drafts || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teacher/courses', requireTeacher, async (req, res) => {
  try {
    const { title, description, status = 'draft' } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const result = await run('INSERT INTO courses (title, description, status) VALUES (?, ?, ?)',
      [title.trim(), description?.trim() || null, status]);
    const course = await get('SELECT * FROM courses WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teacher/courses/:id', requireTeacher, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const course = await get('SELECT id FROM courses WHERE id = ?', [req.params.id]);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    await run('UPDATE courses SET title = ?, description = ?, status = ? WHERE id = ?',
      [title.trim(), description?.trim() || null, status || 'draft', req.params.id]);
    res.json(await get('SELECT * FROM courses WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teacher/courses/:id', requireTeacher, async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const lessonRows = await all('SELECT id FROM lessons WHERE course_id = ?', [courseId]);
    const lessonIds = lessonRows.map(l => l.id);

    if (lessonIds.length) {
      const ph = lessonIds.map(() => '?').join(',');
      await run(`DELETE FROM lesson_completions WHERE lesson_id IN (${ph})`, lessonIds);
      await run(`DELETE FROM submissions WHERE lesson_id IN (${ph})`, lessonIds);
      await run(`DELETE FROM quizzes WHERE lesson_id IN (${ph})`, lessonIds);
      await run('DELETE FROM lessons WHERE course_id = ?', [courseId]);
    }
    await run('DELETE FROM enrollments WHERE course_id = ?', [courseId]);
    await run('DELETE FROM courses WHERE id = ?', [courseId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// Teacher — Lesson CRUD
// ─────────────────────────────────────────

app.post('/api/courses/:id/lessons', requireTeacher, async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { title, description, content, code_example, is_major_assignment = 0, module_number = 1 } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const maxRow = await get('SELECT COALESCE(MAX(order_num), 0) AS max_order FROM lessons WHERE course_id = ?', [courseId]);
    const result = await run(`
      INSERT INTO lessons (course_id, title, content, code_example, order_num, is_major_assignment, module_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [courseId, title.trim(), content?.trim() || description?.trim() || null,
        code_example?.trim() || null, (maxRow?.max_order || 0) + 1,
        is_major_assignment ? 1 : 0, module_number]);

    res.status(201).json(await get('SELECT * FROM lessons WHERE id = ?', [result.lastInsertRowid]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teacher/lessons/:id', requireTeacher, async (req, res) => {
  try {
    const lesson = await get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    const { title, description, content, code_example, order_num, is_major_assignment, module_number } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    await run(`UPDATE lessons SET title=?, content=?, code_example=?, order_num=?, is_major_assignment=?, module_number=? WHERE id=?`,
      [title.trim(), content?.trim() || description?.trim() || lesson.content,
       code_example?.trim() ?? lesson.code_example,
       order_num ?? lesson.order_num,
       is_major_assignment != null ? (is_major_assignment ? 1 : 0) : lesson.is_major_assignment,
       module_number ?? lesson.module_number,
       req.params.id]);
    res.json(await get('SELECT * FROM lessons WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teacher/lessons/:id', requireTeacher, async (req, res) => {
  try {
    const lesson = await get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    await run('DELETE FROM lesson_completions WHERE lesson_id = ?', [lesson.id]);
    await run('DELETE FROM submissions WHERE lesson_id = ?', [lesson.id]);
    await run('DELETE FROM quizzes WHERE lesson_id = ?', [lesson.id]);
    await run('DELETE FROM lessons WHERE id = ?', [lesson.id]);

    const siblings = await all('SELECT id FROM lessons WHERE course_id = ? ORDER BY order_num', [lesson.course_id]);
    for (let i = 0; i < siblings.length; i++) {
      await run('UPDATE lessons SET order_num = ? WHERE id = ?', [i + 1, siblings[i].id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teacher/courses/:id/lessons/reorder', requireTeacher, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    for (let i = 0; i < order.length; i++) {
      await run('UPDATE lessons SET order_num = ? WHERE id = ? AND course_id = ?', [i + 1, order[i], req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teacher/lessons/:id', requireTeacher, async (req, res) => {
  try {
    const lesson = await get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// Lessons (student-facing)
// ─────────────────────────────────────────

app.get('/api/courses/:id/lessons', async (req, res) => {
  try {
    const lessons = await all('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num', [req.params.id]);
    if (req.session.user) await annotateUnlock(req.session.user.id, lessons);
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lessons/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const lesson = await get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const allLessons = await all('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num', [lesson.course_id]);
    await annotateUnlock(userId, allLessons);
    const idx = allLessons.findIndex(l => l.id === lesson.id);
    Object.assign(lesson, {
      completed: allLessons[idx].completed,
      unlocked: allLessons[idx].unlocked,
      prev_id: idx > 0 ? allLessons[idx - 1].id : null,
      next_id: idx < allLessons.length - 1 ? allLessons[idx + 1].id : null
    });
    res.json(lesson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lessons/:id/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const lessonId = parseInt(req.params.id);
    const lesson = await get('SELECT course_id FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    await run('INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)', [userId, lessonId]);
    const progress = await recalcProgress(userId, lesson.course_id);
    res.json({ success: true, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lessons/:id/uncomplete', requireAuth, async (req, res) => {
  try {
    const userId   = req.session.user.id;
    const lessonId = parseInt(req.params.id);
    const lesson   = await get('SELECT course_id FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    await run('DELETE FROM exercise_attempts WHERE user_id = ? AND lesson_id = ?', [userId, lessonId]);
    await run('DELETE FROM submissions WHERE user_id = ? AND lesson_id = ?', [userId, lessonId]);
    await run('DELETE FROM lesson_completions WHERE user_id = ? AND lesson_id = ?', [userId, lessonId]);
    const progress = await recalcProgress(userId, lesson.course_id);
    res.json({ success: true, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lessons/:id/progress', requireAuth, async (req, res) => {
  try {
    const rows = await all(`
      SELECT interactive_index, exercise_index, answer_index, passed
      FROM exercise_attempts
      WHERE user_id = ? AND lesson_id = ? AND passed = 1
      ORDER BY interactive_index ASC
    `, [req.session.user.id, req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lessons/:id/submissions', requireAuth, async (req, res) => {
  try {
    const subs = await all(`
      SELECT * FROM submissions
      WHERE user_id = ? AND lesson_id = ?
      ORDER BY assignment_index ASC
    `, [req.session.user.id, req.params.id]);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// Exercises
// ─────────────────────────────────────────

app.post('/api/exercises/check', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { lesson_id, exercise_index, interactive_index, answer_index, passed } = req.body;

    if (passed) {
      await run(`
        INSERT INTO exercise_attempts
          (user_id, lesson_id, exercise_index, interactive_index, answer_index, passed, attempted_at)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, lesson_id, interactive_index)
        DO UPDATE SET answer_index=excluded.answer_index, passed=1, attempted_at=CURRENT_TIMESTAMP
      `, [userId, lesson_id, exercise_index ?? 0, interactive_index ?? exercise_index ?? 0, answer_index ?? 0]);

      const lesson = await get('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
      if (lesson) {
        let content = {};
        try { content = JSON.parse(lesson.content || '{}'); } catch (_) {}
        const totalInteractive = (content.blocks || []).filter(b =>
          ['exercise', 'challenge', 'assignment'].includes(b.type)
        ).length;
        if (totalInteractive > 0) {
          const cntRow = await get(`
            SELECT COUNT(*) as cnt FROM exercise_attempts
            WHERE user_id = ? AND lesson_id = ? AND passed = 1
          `, [userId, lesson_id]);
          if ((cntRow?.cnt || 0) >= totalInteractive) {
            await run('INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)', [userId, lesson_id]);
            await recalcProgress(userId, lesson.course_id);
          }
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────

app.post('/api/submissions/major', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { lesson_id, assignment_index, code, submission_type } = req.body;
    if (!lesson_id) return res.status(400).json({ error: 'lesson_id required' });

    const lesson = await get('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    let content = {};
    try { content = JSON.parse(lesson.content || '{}'); } catch (_) {}
    const asgnBlocks = (content.blocks || []).filter(b => b.type === 'assignment');
    const asIdx = assignment_index ?? 0;
    const block = asgnBlocks[asIdx];
    if (!block) return res.status(404).json({ error: 'Assignment block not found' });

    const existing = await get(`
      SELECT * FROM submissions WHERE user_id = ? AND lesson_id = ? AND assignment_index = ?
    `, [userId, lesson_id, asIdx]);

    if (existing) {
      await run(`UPDATE submissions SET code=?, status='pending', submitted_at=CURRENT_TIMESTAMP,
        resubmission_count=resubmission_count+1, feedback=NULL WHERE id=?`, [code, existing.id]);
      return res.json({ id: existing.id, status: 'pending' });
    }

    const result = await run(`
      INSERT INTO submissions
        (user_id, lesson_id, assignment_index, code, submission_type, status, is_major,
         submitted_at, assignment_title, points, requirements)
      VALUES (?, ?, ?, ?, ?, 'pending', 1, CURRENT_TIMESTAMP, ?, ?, ?)
    `, [userId, lesson_id, asIdx, code,
        submission_type || block.submissionType || 'code',
        block.assignmentTitle || 'Assignment',
        block.points || 100,
        JSON.stringify(block.requirements || [])]);

    res.json({ id: result.lastInsertRowid, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/submissions/:id/resubmit', requireAuth, async (req, res) => {
  try {
    const sub = await get('SELECT * FROM submissions WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    if (sub.status !== 'needs_revision') return res.status(400).json({ error: 'Cannot resubmit' });
    await run(`UPDATE submissions SET code=?, status='pending', submitted_at=CURRENT_TIMESTAMP,
      resubmission_count=resubmission_count+1, feedback=NULL WHERE id=?`, [req.body.code, sub.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/submissions/:id/review', requireTeacher, async (req, res) => {
  try {
    const { verdict, feedback, requirement_grades, score } = req.body;
    if (!['passed', 'needs_revision'].includes(verdict)) return res.status(400).json({ error: 'Invalid verdict' });

    const sub = await get('SELECT * FROM submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Not found' });

    await run(`UPDATE submissions SET status=?, feedback=?, requirement_grades=?, score=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
      [verdict, feedback || null, JSON.stringify(requirement_grades || []), score || null, sub.id]);

    if (verdict === 'passed' && sub.lesson_id) {
      const lesson = await get('SELECT * FROM lessons WHERE id = ?', [sub.lesson_id]);
      if (lesson) {
        await run('INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)', [sub.user_id, sub.lesson_id]);
        await recalcProgress(sub.user_id, lesson.course_id);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teacher/major-assignments', requireTeacher, async (req, res) => {
  try {
    const filter = req.query.filter || 'pending';
    let where = 's.is_major = 1';
    if (filter !== 'all') where += ` AND s.status = '${filter}'`;

    const rows = await all(`
      SELECT s.*,
        u.name AS student_name,
        c.title AS course_title
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      JOIN lessons l ON l.id = s.lesson_id
      JOIN courses c ON c.id = l.course_id
      WHERE ${where}
      ORDER BY s.submitted_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/submissions/:id/messages', requireAuth, async (req, res) => {
  try {
    const msgs = await all(`
      SELECT m.*, u.name AS sender_name, u.id AS sender_id FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.submission_id = ? ORDER BY m.sent_at
    `, [req.params.id]);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/submissions/:id/message', requireAuth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
    const sub = await get('SELECT id FROM submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    await run('INSERT INTO messages (submission_id, sender_id, body) VALUES (?, ?, ?)',
      [sub.id, req.session.user.id, body.trim()]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route — serves any .html file from the public folder
app.get('/:page.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', `${req.params.page}.html`), (err) => {
    if (err) res.status(404).send('Page not found');
  });
});

app.listen(3000, () => console.log('LMS running at http://localhost:3000'));