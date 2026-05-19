// seed-html-course.js — run with: node seed-html-course.js
const Database = require('better-sqlite3');
const db = new Database('database.db');

const run = (sql, ...params) => db.prepare(sql).run(...params);
const get = (sql, ...params) => db.prepare(sql).get(...params);

console.log('Seeding HTML Fundamentals course...\n');

/* ── 1. Course ── */
let course = get("SELECT id FROM courses WHERE title = 'HTML Fundamentals'");
if (!course) {
  const r = run(
    "INSERT INTO courses (title, description, status) VALUES (?, ?, ?)",
    'HTML Fundamentals', 'Learn HTML from scratch with hands-on examples', 'published'
  );
  course = { id: r.lastInsertRowid };
  console.log('Course inserted id=' + course.id);
} else {
  console.log('Course already exists id=' + course.id);
}
const courseId = course.id;

/* ── 2. Lessons ── */
const lessonDefs = [
  {
    order_num: 1, module_number: 1, is_major_assignment: 0,
    title: 'HTML Tutorial',
    code_example: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Page Title</title>\n</head>\n<body>\n  <h1>This is a Heading</h1>\n  <p>This is a paragraph.</p>\n</body>\n</html>',
    content: '{"points":["HTML is the standard markup language for Web pages","With HTML you can create your own Website","HTML is easy to learn"],"try_it":true}',
  },
  {
    order_num: 2, module_number: 1, is_major_assignment: 0,
    title: 'HTML Introduction',
    code_example: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Page Title</title>\n</head>\n<body>\n  <h1>My First Heading</h1>\n  <p>My first paragraph.</p>\n</body>\n</html>',
    content: '{"points":["HTML stands for Hyper Text Markup Language","HTML is the standard markup language for creating Web pages","HTML describes the structure of a Web page","HTML consists of a series of elements","HTML elements tell the browser how to display the content"],"explained":["<!DOCTYPE html> defines this is an HTML5 document","<html> is the root element of an HTML page","<head> contains meta information about the HTML page","<title> specifies a title shown in the browser tab","<body> defines the document body with all visible content","<h1> defines a large heading","<p> defines a paragraph"],"element_table":[{"start":"<h1>","content":"My First Heading","end":"</h1>"},{"start":"<p>","content":"My first paragraph.","end":"</p>"},{"start":"<br>","content":"none","end":"none"}],"note":"Some HTML elements have no content (like <br>). These are called empty elements and have no end tag.","history":[{"year":1989,"event":"Tim Berners-Lee invented www"},{"year":1991,"event":"Tim Berners-Lee invented HTML"},{"year":1993,"event":"Dave Raggett drafted HTML+"},{"year":1995,"event":"HTML Working Group defined HTML 2.0"},{"year":1997,"event":"W3C Recommendation: HTML 3.2"},{"year":1999,"event":"W3C Recommendation: HTML 4.01"},{"year":2008,"event":"WHATWG HTML5 First Public Draft"},{"year":2014,"event":"W3C Recommendation: HTML5"},{"year":2017,"event":"W3C Recommendation: HTML5.2"}],"try_it":true}',
  },
  {
    order_num: 3, module_number: 1, is_major_assignment: 0,
    title: 'HTML Editors',
    code_example: '<!DOCTYPE html>\n<html>\n<body>\n  <h1>My First Heading</h1>\n  <p>My first paragraph.</p>\n</body>\n</html>',
    content: '{"points":["Web pages can be created with professional HTML editors","For learning HTML, a simple text editor like Notepad (PC) or TextEdit (Mac) is recommended"],"steps":[{"step":"Step 1","title":"Open Notepad (Windows) or TextEdit (Mac)","desc":"Windows: Open Start menu, search for Notepad and open it. Mac: Open Finder > Applications > TextEdit. Change preferences to Plain Text mode."},{"step":"Step 2","title":"Write Some HTML","desc":"Write or copy the HTML code into the text editor."},{"step":"Step 3","title":"Save the HTML Page","desc":"Save as index.htm or index.html. Select UTF-8 encoding. You can use either .htm or .html."},{"step":"Step 4","title":"View in Your Browser","desc":"Open the saved file in your favourite browser. The result will look much like a real website."}],"tip":"You can use either .htm or .html as file extension. There is no difference - it is entirely up to you.","try_it":true}',
  },
  {
    order_num: 4, module_number: 1, is_major_assignment: 0,
    title: 'HTML Basic Examples',
    code_example: '<h1>This is heading 1</h1>\n<h2>This is heading 2</h2>\n<p>This is a paragraph.</p>\n<a href="https://www.w3schools.com">This is a link</a>',
    content: '{"points":["All HTML documents start with <!DOCTYPE html>","The document begins with <html> and ends with </html>","Visible content is between <body> and </body>"],"sections":[{"title":"HTML Headings","desc":"HTML headings are defined with the <h1> to <h6> tags. <h1> defines the most important heading.","code":"<h1>This is heading 1</h1>\\n<h2>This is heading 2</h2>\\n<h3>This is heading 3</h3>"},{"title":"HTML Paragraphs","desc":"HTML paragraphs are defined with the <p> tag.","code":"<p>This is a paragraph.</p>\\n<p>This is another paragraph.</p>"},{"title":"HTML Links","desc":"HTML links are defined with the <a> tag. The link destination is specified in the href attribute.","code":"<a href=\\"https://www.w3schools.com\\">This is a link</a>"},{"title":"HTML Images","desc":"HTML images are defined with the <img> tag using src, alt, width, and height attributes.","code":"<img src=\\"w3schools.jpg\\" alt=\\"W3Schools.com\\" width=\\"104\\" height=\\"142\\">"}],"tip":"Right-click in your browser and select View Page Source (CTRL+U) to see the HTML. Use right-click Inspect to see HTML and CSS.","try_it":true}',
  },
  {
    order_num: 5, module_number: 1, is_major_assignment: 1,
    title: 'HTML Elements',
    code_example: '<!DOCTYPE html>\n<html>\n<body>\n  <h1>My First Heading</h1>\n  <p>My first paragraph.</p>\n</body>\n</html>',
    content: '{"points":["An HTML element is everything from the start tag to the end tag","Structure: <tagname>Content goes here...</tagname>","Examples: <h1>My First Heading</h1> and <p>My first paragraph.</p>"],"element_table":[{"start":"<h1>","content":"My First Heading","end":"</h1>"},{"start":"<p>","content":"My first paragraph.","end":"</p>"},{"start":"<br>","content":"none","end":"none"}],"sections":[{"title":"Nested HTML Elements","desc":"HTML elements can be nested. All HTML documents consist of nested HTML elements.","code":"<!DOCTYPE html>\\n<html>\\n<body>\\n  <h1>My First Heading</h1>\\n  <p>My first paragraph.</p>\\n</body>\\n</html>","warning":false},{"title":"Never Skip the End Tag","desc":"Some HTML elements will display correctly even without an end tag - but never rely on this! Unexpected results and errors may occur.","code":"<p>This is a paragraph\\n<p>This is a paragraph","warning":true},{"title":"Empty HTML Elements","desc":"HTML elements with no content are called empty elements. The <br> tag defines a line break and is an empty element without a closing tag.","code":"<p>This is a <br> paragraph with a line break.</p>","warning":false},{"title":"HTML is Not Case Sensitive","desc":"<P> means the same as <p>. W3C recommends lowercase in HTML and demands it for stricter document types like XHTML.","code":null,"warning":false}],"tag_reference":[{"tag":"<html>","desc":"Defines the root of an HTML document"},{"tag":"<body>","desc":"Defines the document body"},{"tag":"<h1> to <h6>","desc":"Defines HTML headings"}],"try_it":true}',
  },
];

const lessonIds = [];
for (const l of lessonDefs) {
  const existing = get('SELECT id FROM lessons WHERE course_id = ? AND order_num = ?', courseId, l.order_num);
  if (existing) {
    lessonIds.push(existing.id);
    console.log('Lesson ' + l.order_num + ' already exists id=' + existing.id);
    continue;
  }
  const r = run(
    'INSERT INTO lessons (course_id, title, content, code_example, order_num, module_number, is_major_assignment) VALUES (?, ?, ?, ?, ?, ?, ?)',
    courseId, l.title, l.content, l.code_example, l.order_num, l.module_number, l.is_major_assignment
  );
  lessonIds.push(r.lastInsertRowid);
  console.log('Lesson ' + l.order_num + ': "' + l.title + '" id=' + r.lastInsertRowid);
}

/* ── 3. Assignments ── */
console.log('\nSeeding assignments...');

const assignmentDefs = [
  {
    idx: 0, type: 'exercise', points: 10,
    title: 'HTML Hyperlink Syntax',
    correct_answer: 'a',
    description: JSON.stringify({ question: 'What is a correct syntax for an HTML hyperlink?', options: [{ key: 'a', text: "<a href='/home.htm'>Visit W3Schools.com!</a>", correct: true },{ key: 'b', text: "<link href='/home.htm'>Visit W3Schools.com!</link>", correct: false },{ key: 'c', text: "<alink href='/home.htm'>Visit W3Schools.com!</alink>", correct: false }], practice: 'Create your own HTML page with a title tag in the head and at least one heading and one paragraph in the body.' }),
    requirements: null,
    starter_code: null,
  },
  {
    idx: 1, type: 'exercise', points: 10,
    title: 'What does HTML stand for?',
    correct_answer: 'c',
    description: JSON.stringify({ question: 'What does HTML stand for?', options: [{ key: 'a', text: 'Hot Typing Markup Language', correct: false },{ key: 'b', text: 'Home Typing Modern Language', correct: false },{ key: 'c', text: 'Hyper Text Markup Language', correct: true },{ key: 'd', text: 'Home Testing Mixed Language', correct: false }], practice: 'Build a page about yourself. Include: a proper DOCTYPE, html/head/body structure, a title tag, an h1 with your name, and a paragraph describing yourself.' }),
    requirements: null,
    starter_code: null,
  },
  {
    idx: 2, type: 'exercise', points: 10,
    title: 'DOCTYPE Declaration',
    correct_answer: 'a',
    description: JSON.stringify({ question: 'What is a correct HTML markup for the document type declaration?', options: [{ key: 'a', text: '<!DOCTYPE html>', correct: true },{ key: 'b', text: 'DOCTYPE html;', correct: false },{ key: 'c', text: '--DOCTYPE html;', correct: false }], practice: 'Create an HTML file on your computer using a text editor. Add a heading, two paragraphs, and save it as mypage.html. Paste your final code in the submission box.' }),
    requirements: null,
    starter_code: null,
  },
  {
    idx: 3, type: 'exercise', points: 10,
    title: 'HTML Document Structure',
    correct_answer: 'a',
    description: JSON.stringify({ question: 'What is a correct HTML markup for the document type declaration?', options: [{ key: 'a', text: '<!DOCTYPE html>', correct: true },{ key: 'b', text: 'DOCTYPE html;', correct: false },{ key: 'c', text: '--DOCTYPE html;', correct: false }], practice: 'Create a webpage that has: an h1 heading, an h2 heading, two paragraphs, one link to your favorite website, and one image with proper alt text.' }),
    requirements: null,
    starter_code: null,
  },
  {
    idx: 4, type: 'major', points: 100,
    title: 'Module 1 Major Assignment — HTML Foundations',
    correct_answer: 'b',
    description: JSON.stringify({ question: 'True or False. Empty elements must have a close tag.', options: [{ key: 'a', text: 'True', correct: false },{ key: 'b', text: 'False', correct: true }], practice: null }),
    requirements: JSON.stringify(['DOCTYPE declaration present','html, head, body structure complete','title tag in head','h1 heading present','at least 2 heading levels used','at least 3 paragraphs','at least 1 link with href','at least 1 image with alt text','all tags properly closed','all tags lowercase']),
    starter_code: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  <!-- Write your content here -->\n  \n</body>\n</html>',
  },
];

for (const a of assignmentDefs) {
  const lessonId = lessonIds[a.idx];
  const existing = get('SELECT id FROM assignments WHERE lesson_id = ?', lessonId);
  if (existing) { console.log('Assignment for lesson ' + (a.idx + 1) + ' already exists'); continue; }
  run(
    'INSERT INTO assignments (lesson_id, type, title, description, requirements, points, starter_code, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    lessonId, a.type, a.title, a.description, a.requirements, a.points, a.starter_code, a.correct_answer
  );
  console.log('Assignment for lesson ' + (a.idx + 1) + ': "' + a.title + '" (' + a.type + ')');
}

/* ── Summary ── */
const lCount = db.prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?').get(courseId).c;
const aCount = db.prepare('SELECT COUNT(*) as c FROM assignments WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ?)').get(courseId).c;
console.log('\nDone! Course=' + courseId + ' Lessons=' + lCount + ' Assignments=' + aCount);
console.log('Open: http://localhost:3000/lesson.html?id=' + lessonIds[0]);