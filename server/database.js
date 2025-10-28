//import SQLite
const Database = require('better-sqlite3');
const path = require('path');


//Database Initialisation
const dbPath =path.join(__dirname, '../database/classroom.db');
const db = new Database(dbPath);

//Enabling foreign keys
db.pragma('foreign_keys = ON');

//users Table
db.exec(`
   CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN('student', 'teacher', 'admin')),
    full_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT TIMESTAMP,
    last_login DATETIME
   )   
`);

//classes Table 
db.exec(`
   CREATE TABLE IF NOT EXISTS classes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name Text NOT NULL,
    description TEXT,
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
   )
`)

//Enrollments table
db.exec(`
    CREATE TABLE IF NOT EXISTS enrollments(
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     student_id INTEGER,
     class_id INTEGER,
     enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (student_id)REFERENCES users(id),
     FOREIGN KEY (class_id)REFERENCES classes(id)
    )
`)

//Assignments Table
db.exec(`
   CREATE TABLE IF NOT EXISTS assignments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATETIME,
    points INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id)
  )
`)

//Submissions Table
db.exec(`
   CREATE TABLE IF NOT EXISTS submissions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    content TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    grade INTEGER,
    feedback TEXT,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  )
`)

//Messages Table
db.exec(`
   CREATE TABLE IF NOT EXISTS messages(
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
)
`)

//AI_Training_Data table
db.exec(`
   CREATE TABLE IF NOT EXISTS ai_training_data(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    confidence_score REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP 
  )  
`);

//Database Operation
const dbOperations = {
    //user operations
    createUser: (username, password, email, role, fullName) => {
        const stmt = db.prepare(`
            INSERT INTO users (username, password, email, role, full_name)
            VALUES (?, ?, ?, ? ,?)
        `);
        return stmt.run(username, password, email, role, fullName);
    },
    getUserByUsername: (username) => {
        const stmt = db.prepare('SELECT * FROM users WHERE username= ?');
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

    //class operations
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

    getClassesByStudent:(studentId) => {
        const stmt = db.prepare(`
            SELECT c. * FROM classes c
            JOIN enrollments e ON c.id = e.class_id
            WHERE e.student_id= ?
            `);
            return stmt.all(studentId);
        },

    //Enrollment operations
    enrollStudent: (studentId, classId) => {
        const stmt = db.prepare(`
            INSERT INTO enrollments (student_id, class_id)
            VALUES(?, ?)
            `);
        return stmt.run(studentId, classId);
    },

    //Assignment Operations
    createAssignment: (classId, title, description, dueDate, Points) => {
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

    //Submission Operations
    createSubmission: (assignmentId, studentId, content) => {
        const stmt = db.prepare(`
            INSERT INTO submissions(assignment_id, student_id, content)
            VALUES (?, ?, ?)
            `);
        return stmt.run(assignmentId, studentId, content);
    },

    gradeSubmission: (submissionId, grade, feedback) => {
        const stmt = db.prepare(`
            UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?
            `);
        return stmt.run(grade, feedback, submissionId);
    }

    getSubmissionsByStudent: (studentId) => {
        const stmt = db.prepare(`
           SELECT s.*, a.title as assignment_title, a.points
           FROM submissions s 
           JOIN assignments a ON s.assignment_id = a.id
           WHERE s.student_id = ?  
        `);

        return stmt.all(studentId)
    },

    //Message operations
    createMessage: (senderId, receiverId, classId, content, isAI = false) => {
        const stmt = db.prepare(`
            INSERT INTO messages (sender_id, receiver_id, class_id, content, is_ai_response)
            VALUES (?, ?, ?, ?, ?)
            `);
        return stmt.run(senderId, receiverId, classId, content, isAI ? 1:0);
            
    },

    getMessagesByClass: (classId, limit = 50) => {
        const stmt = db.prepare(`
            SELECT m.*, u.full_name as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.class_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? 
            `);

        return stmt.all(classId, limit)
    },

    //AI TRAINING DATA OPERATIONS
    addTrainingData: (question, answer, category) => {
        const stmt = db.prepare(`
            INSERT INTO ai_training_data(question, answer, category)
            VALUES (?, ?, ?)
            `);
        return stmt.run(question, answer, category);
    },

    getAllTrainingData:() =>{
        const stmt = db.prepare('SELECT * FROM ai_training_data');
        return stmt.all();
    }
};

//Data Seeding
function seedDatabase() {
    //Trying to check if users already exists
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

    if (userCount.count === 0) {
        //Demo users; not real
        dbOperations.createUser('teacher1', 'password124', 'teacher@school.edu', 'teacher', 'Dr Anselm Icheku')
        dbOperations.createUser('student1', 'password124', 'student1@school.edu', 'student', 'Favour Rose')
        dbOperations.createUser('student2', 'password124', 'student2@school.edu', 'student', 'Theresa Icheku')
        dbOperations.createUser('admin1', 'password124', 'admin@school.edu', 'teacher', 'Martin Luther')

        //Demo classes
        const classResult = dbOperations.createClass('Introduction to computer Science', 'Learn fundamentals of Programming', 1);

        //Demo enrollments
        dbOperations.enrollStudent(2, classResult.lastInsertRowid);
        dbOperations.enrollStudent(2, classResult.lastInsertRowid);

        //demo assignment

        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 7);
        dbOperations.createAssignment(
            classResult.lastInsertRowid,
            'Programming Assignment 1',
            'create a simple calculator program',
            dueDate.toISOString(),
            100
            );

            //Seed AI Training Data 
            const trainingData = [
                {q: 'What is a variable?', a: 'A variable is a container that stores data values. Think of it like a labeled box where you can put information.', cat: 'programming'},
                {q: 'How do i declare a variable in Javascript?', a: 'You can declare a variable using let, const, var keywords. For example let myVariable = 5', cat: 'programming'},
                {q: 'What is a function?', a: 'A function is a reusable block of code that performs a specific task. You define it once and you can call it multiple times ', cat: 'programming'},
                {q: 'What is an Array?', a: 'An Array is a data structure that stores multiple values in a single variable. Example : let fruits = ["apple", "banana", "orange"]', cat: 'programming'},
                {q: 'How do loops work?', a: 'A loop allows one to repeat code multiple times. common types is the for loop, while loop and the forEach loop', cat: 'programming'},
                {q: 'What is debugging?', a: 'Debugging is the process of finding and fixing errors in code. Use console.log() to inspect values and track down issues', cat: 'programming'},
                {q: 'How can i improve my grades?', a: 'Focus on understanding concepts deeply, pratice regularly, ask questions when confused and review materials before exams .', cat: 'study-tips'},
                {q: 'What is time management?', a: 'Time management is organising your schedule to balance studying, assignments and personal life effectively.', cat: 'study-tips'},
                {q: 'How do i submit my assignment?', a: 'Navigate to your class, click on assignment, write or upload your work and then click the submit button.', cat: 'platform'},
                {q: 'Where can i see my grades ?', a: 'Your grades are visible in the grade section of your dashboard oer within each individual assignments after it has been graded .', cat: 'platform'}

            ];

            trainingData.forEach(data => {
                dbOperations.addTrainingData(data.q, data.a, data.cat)
            });

            console.log('...Database seeded with initial data');
        

    }

}

seedDatabase();
module.exports = {db, dbOperations} 

