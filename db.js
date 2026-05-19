const Database = require('better-sqlite3');
const db = new Database('database.db');

/* Safe ALTER TABLE — silently no-ops if column already exists */
const addCol = (table, col, def) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (_) {}
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT DEFAULT 'student'
  );

  CREATE TABLE IF NOT EXISTS courses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id           INTEGER,
    title               TEXT,
    content             TEXT,
    code_example        TEXT,
    order_num           INTEGER,
    is_major_assignment INTEGER DEFAULT 0,
    module_number       INTEGER DEFAULT 1,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    user_id   INTEGER,
    course_id INTEGER,
    progress  INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    questions TEXT,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );

  CREATE TABLE IF NOT EXISTS lesson_completions (
    user_id      INTEGER,
    lesson_id    INTEGER,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id      INTEGER UNIQUE,
    type           TEXT    DEFAULT 'exercise',
    title          TEXT,
    description    TEXT,
    requirements   TEXT,
    points         INTEGER DEFAULT 10,
    starter_code   TEXT,
    correct_answer TEXT,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER,
    assignment_id      INTEGER,
    code               TEXT,
    answer             TEXT,
    status             TEXT    DEFAULT 'pending',
    feedback           TEXT,
    requirement_grades TEXT,
    resubmission_count INTEGER DEFAULT 0,
    is_major           INTEGER DEFAULT 0,
    submitted_at       TEXT    DEFAULT (datetime('now')),
    reviewed_at        TEXT,
    FOREIGN KEY (user_id)       REFERENCES users(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER,
    sender_id     INTEGER,
    body          TEXT NOT NULL,
    sent_at       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submission_id) REFERENCES submissions(id),
    FOREIGN KEY (sender_id)     REFERENCES users(id)
  );
`);

/* Migrate existing databases — no-ops on fresh installs */
addCol('lessons', 'code_example',        'TEXT');
addCol('lessons', 'is_major_assignment', 'INTEGER DEFAULT 0');
addCol('lessons', 'module_number',       'INTEGER DEFAULT 1');
addCol('courses', 'status', "TEXT DEFAULT 'draft'");
addCol('submissions', 'lesson_id', 'INTEGER');
addCol('submissions', 'assignment_index', 'INTEGER DEFAULT 0');
addCol('submissions', 'submission_type', "TEXT DEFAULT 'code'");
addCol('submissions', 'assignment_title', 'TEXT');
addCol('submissions', 'points', 'INTEGER DEFAULT 100');
addCol('submissions', 'requirements', 'TEXT');
addCol('submissions', 'score', 'INTEGER');
addCol('exercise_attempts', 'interactive_index', 'INTEGER DEFAULT 0');


db.prepare(`
  CREATE TABLE IF NOT EXISTS exercise_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    exercise_index INTEGER DEFAULT 0,
    interactive_index INTEGER DEFAULT 0,
    answer_index INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, lesson_id, interactive_index)
  )
`).run();
 

console.log('Database initialized successfully!');
module.exports = db;
