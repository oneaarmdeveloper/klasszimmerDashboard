// import SQLite
const Database = require('better-sqlite3');
const path = require('path');

// Database initialization
const dbPath = path.join(__dirname, '../database/classroom.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// users Table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN('student', 'teacher', 'admin')),
    full_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );
`);

// classes Table
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  );
`);

// enrollments Table
db.exec(`
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    class_id INTEGER,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (class_id) REFERENCES classes(id)
  );
`);

// assignments Table
db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATETIME,
    points INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id)
  );
`);

// submissions Table
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    content TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    grade INTEGER,
    feedback TEXT,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  );
`);

// messages Table
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    class_id INTEGER,
    content TEXT NOT NULL,
    is_ai_response BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (class_id) REFERENCES classes(id)
  );
`);

// ai_training_data Table
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    confidence_score REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Database operations
const dbOperations = {
  // user operations
  createUser: (username, password, email, role, fullName) => {
    const stmt = db.prepare(`
      INSERT INTO users (username, password, email, role, full_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(username, password, email, role, fullName);
  },

  getUserByUsername: (username) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  },

  getUserById: (id) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  },

  updateLastLogin: (userId) => {
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(userId);
  },

  // class operations
  createClass: (name, description, teacherId) => {
    const stmt = db.prepare(`
      INSERT INTO classes (name, description, teacher_id)
      VALUES (?, ?, ?)
    `);
    return stmt.run(name, description, teacherId);
  },

  getClassesByTeacher: (teacherId) => {
    const stmt = db.prepare('SELECT * FROM classes WHERE teacher_id = ?');
    return stmt.all(teacherId);
  },

  getClassesByStudent: (studentId) => {
    const stmt = db.prepare(`
      SELECT c.* FROM classes c
      JOIN enrollments e ON c.id = e.class_id
      WHERE e.student_id = ?
    `);
    return stmt.all(studentId);
  },

  // Enrollment operations
  enrollStudent: (studentId, classId) => {
    const stmt = db.prepare(`
      INSERT INTO enrollments (student_id, class_id)
      VALUES (?, ?)
    `);
    return stmt.run(studentId, classId);
  },

  // Assignment operations
  createAssignment: (classId, title, description, dueDate, points) => {
    const stmt = db.prepare(`
      INSERT INTO assignments (class_id, title, description, due_date, points)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(classId, title, description, dueDate, points);
  },

  getAssignmentsByClass: (classId) => {
    const stmt = db.prepare('SELECT * FROM assignments WHERE class_id = ?');
    return stmt.all(classId);
  },

  // Submission operations
  createSubmission: (assignmentId, studentId, content) => {
    const stmt = db.prepare(`
      INSERT INTO submissions (assignment_id, student_id, content)
      VALUES (?, ?, ?)
    `);
    return stmt.run(assignmentId, studentId, content);
  },

  gradeSubmission: (submissionId, grade, feedback) => {
    const stmt = db.prepare(`
      UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?
    `);
    return stmt.run(grade, feedback, submissionId);
  },

  getSubmissionsByStudent: (studentId) => {
    const stmt = db.prepare(`
      SELECT s.*, a.title AS assignment_title, a.points
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.student_id = ?
    `);
    return stmt.all(studentId);
  },

  // Message operations
  createMessage: (senderId, receiverId, classId, content, isAI = false) => {
    const stmt = db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, class_id, content, is_ai_response)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(senderId, receiverId, classId, content, isAI ? 1 : 0);
  },

  getMessagesByClass: (classId, limit = 50) => {
    const stmt = db.prepare(`
      SELECT m.*, u.full_name AS sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.class_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `);
    return stmt.all(classId, limit);
  },

  // AI training data operations
  addTrainingData: (question, answer, category) => {
    const stmt = db.prepare(`
      INSERT INTO ai_training_data (question, answer, category)
      VALUES (?, ?, ?)
    `);
    return stmt.run(question, answer, category);
  },

  getAllTrainingData: () => {
    const stmt = db.prepare('SELECT * FROM ai_training_data');
    return stmt.all();
  }
};

// Data seeding
function seedDatabase() {
  const userCountRow = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  const userCount = userCountRow ? userCountRow.count : 0;

  if (userCount === 0) {
    // Demo users (never use plaintext passwords in production)
    const teacher1 = dbOperations.createUser('teacher1', 'password124', 'teacher@school.edu', 'teacher', 'Dr Anselm Icheku');
    const student1 = dbOperations.createUser('student1', 'password124', 'student1@school.edu', 'student', 'Favour Rose');
    const student2 = dbOperations.createUser('student2', 'password124', 'student2@school.edu', 'student', 'Theresa Icheku');
    const admin1 = dbOperations.createUser('admin1', 'password124', 'admin@school.edu', 'admin', 'Martin Luther');

    // Demo class (teacher id assumed from teacher1.lastInsertRowid)
    const classResult = dbOperations.createClass('Introduction to Computer Science', 'Learn fundamentals of Programming', teacher1.lastInsertRowid);

    // Demo enrollments (use the two students)
    dbOperations.enrollStudent(student1.lastInsertRowid, classResult.lastInsertRowid);
    dbOperations.enrollStudent(student2.lastInsertRowid, classResult.lastInsertRowid);

    // Demo assignment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    dbOperations.createAssignment(
      classResult.lastInsertRowid,
      'Programming Assignment 1',
      'Create a simple calculator program',
      dueDate.toISOString(),
      100
    );

    // Seed AI training data
    const trainingData = [
      { q: 'What is a variable?', a: 'A variable is a container that stores data values. Think of it like a labeled box where you can put information.', cat: 'programming' },
      { q: 'How do I declare a variable in JavaScript?', a: 'You can declare a variable using let, const, or var. Example: let myVariable = 5', cat: 'programming' },
      { q: 'What is a function?', a: 'A function is a reusable block of code that performs a specific task. Define it once and call it multiple times.', cat: 'programming' },
      { q: 'What is an array?', a: 'An array is a data structure that stores multiple values in a single variable. Example: let fruits = [\"apple\", \"banana\", \"orange\"]', cat: 'programming' },
      { q: 'How do loops work?', a: 'A loop allows repeating code multiple times. Common types: for, while, and forEach loops.', cat: 'programming' },
      { q: 'What is debugging?', a: 'Debugging is the process of finding and fixing errors in code. Use console.log() to inspect values.', cat: 'programming' },
      { q: 'How can I improve my grades?', a: 'Focus on understanding concepts, practice regularly, ask questions, and review materials before exams.', cat: 'study-tips' },
      { q: 'What is time management?', a: 'Time management is organizing your schedule to balance studying, assignments, and personal life effectively.', cat: 'study-tips' },
      { q: 'How do I submit my assignment?', a: 'Navigate to your class, select the assignment, upload or paste your work, and click submit.', cat: 'platform' },
      { q: 'Where can I see my grades?', a: 'Your grades are visible in the Grades section of your dashboard or within each graded assignment.', cat: 'platform' }
    ];

    trainingData.forEach(data => {
      dbOperations.addTrainingData(data.q, data.a, data.cat);
    });

    console.log('...Database seeded with initial data');
  }
}

seedDatabase();

module.exports = { db, dbOperations };
