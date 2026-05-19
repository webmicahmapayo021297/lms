CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'student'
  );
INSERT INTO users VALUES(1,'Teacher','teacher@lms.com','$2b$10$6I/fD4KtEfXDRqqQWeGTmeGJOsk.n1sImqRrJQGodpFnXXg97gEdG','teacher');
INSERT INTO users VALUES(2,'Student','student@lms.com','$2b$10$BMjIGrB1c0GpLZp/UmXKF.5CirPan8TpZzCWOOf9dmuc5Vnzc3nNq','student');
INSERT INTO users VALUES(4,'Micah','micah@lms.com','$2b$10$AKlFxMoCoxk7trEfK4WosefkmC.JQ.BfZpHIffLZGr.EH/PAJ43Fi','student');
INSERT INTO users VALUES(5,'Ms. Garcia','garcia@school.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','teacher');
INSERT INTO users VALUES(6,'Mr. Santos','santos@school.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','teacher');
INSERT INTO users VALUES(7,'Alice Reyes','alice@student.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','student');
INSERT INTO users VALUES(8,'Ben Cruz','ben@student.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','student');
INSERT INTO users VALUES(9,'Clara Diaz','clara@student.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','student');
INSERT INTO users VALUES(10,'David Lim','david@student.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','student');
INSERT INTO users VALUES(11,'Eva Mendoza','eva@student.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','student');
INSERT INTO users VALUES(12,'Frank Torres','frank@student.com','$2b$10$pesu8tJvQMBgxWZpBKSKReM.eRJaR4cfhyOx.ReS59aiIVDzJ5X/6','student');
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
  , status TEXT DEFAULT 'draft');
INSERT INTO courses VALUES(8,'HTML','Learn the fundamentals of HTML','published');
CREATE TABLE lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    title TEXT,
    content TEXT,
    order_num INTEGER, code_example TEXT, is_major_assignment INTEGER DEFAULT 0, module_number INTEGER DEFAULT 1,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );
CREATE TABLE enrollments (
    user_id INTEGER,
    course_id INTEGER,
    progress INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, course_id)
  );
INSERT INTO enrollments VALUES(12,8,0);
CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    questions TEXT,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );
CREATE TABLE lesson_completions (
    user_id INTEGER,
    lesson_id INTEGER,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );
CREATE TABLE assignments (
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
CREATE TABLE submissions (
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
    reviewed_at        TEXT, lesson_id INTEGER, assignment_index INTEGER DEFAULT 0, submission_type TEXT DEFAULT 'code', assignment_title TEXT, points INTEGER DEFAULT 100, requirements TEXT, score INTEGER,
    FOREIGN KEY (user_id)       REFERENCES users(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
  );
CREATE TABLE messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER,
    sender_id     INTEGER,
    body          TEXT NOT NULL,
    sent_at       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submission_id) REFERENCES submissions(id),
    FOREIGN KEY (sender_id)     REFERENCES users(id)
  );
CREATE TABLE exercise_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    exercise_index INTEGER DEFAULT 0,
    interactive_index INTEGER DEFAULT 0,
    answer_index INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, lesson_id, interactive_index)
  );
INSERT INTO exercise_attempts VALUES(1,12,42,0,0,0,1,'2026-04-30 04:54:09');
INSERT INTO sqlite_sequence VALUES('users',12);
INSERT INTO sqlite_sequence VALUES('courses',8);
INSERT INTO sqlite_sequence VALUES('lessons',42);
INSERT INTO sqlite_sequence VALUES('assignments',11);
INSERT INTO sqlite_sequence VALUES('submissions',1);
INSERT INTO sqlite_sequence VALUES('exercise_attempts',1);
