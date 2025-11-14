const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { dbOperations } = require('./database');
const authModule = require('./auth');
const aiEngine = require('./ai-engine');
const wsManager = require('./websocket');

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// API Routes Handler
async function handleAPI(req, res, pathname, parsedUrl) {
  res.setHeader('Content-Type', 'application/json');

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    // Authentication endpoints
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = await parseBody(req);
      const result = authModule.login(username, password);
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const { username, password, email, role, fullName } = await parseBody(req);
      const result = authModule.register(username, password, email, role, fullName);
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = req.headers.authorization?.split(' ')[1];
      const result = authModule.logout(token);
      res.end(JSON.stringify(result));
      return;
    }

    // Verify token for protected routes
    const token = req.headers.authorization?.split(' ')[1];
    const authResult = authModule.verifyToken(token);

    if (!authResult.valid && !pathname.includes('/api/auth/')) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const userId = authResult.session?.userId;

    // User endpoints
    if (pathname === '/api/user/profile' && req.method === 'GET') {
      const user = dbOperations.getUserById(userId);
      delete user.password;
      res.end(JSON.stringify({ success: true, user }));
      return;
    }

    // Class endpoints
    if (pathname === '/api/classes' && req.method === 'GET') {
      const user = dbOperations.getUserById(userId);
      let classes;

      if (user.role === 'teacher') {
        classes = dbOperations.getClassesByTeacher(userId);
      } else {
        classes = dbOperations.getClassesByStudent(userId);
      }

      res.end(JSON.stringify({ success: true, classes }));
      return;
    }

    if (pathname === '/api/classes' && req.method === 'POST') {
      const { name, description } = await parseBody(req);
      const result = dbOperations.createClass(name, description, userId);
      res.end(JSON.stringify({ success: true, classId: result.lastInsertRowid }));
      return;
    }

    // Assignment endpoints
    if (pathname.startsWith('/api/assignments/')) {
      const classId = pathname.split('/')[3];

      if (req.method === 'GET') {
        const assignments = dbOperations.getAssignmentsByClass(classId);
        res.end(JSON.stringify({ success: true, assignments }));
        return;
      }

      if (req.method === 'POST') {
        const { title, description, dueDate, points } = await parseBody(req);
        const result = dbOperations.createAssignment(classId, title, description, dueDate, points);
        res.end(JSON.stringify({ success: true, assignmentId: result.lastInsertRowid }));
        return;
      }
    }

    // Submission endpoints
    if (pathname === '/api/submissions' && req.method === 'POST') {
      const { assignmentId, content } = await parseBody(req);
      const result = dbOperations.createSubmission(assignmentId, userId, content);
      res.end(JSON.stringify({ success: true, submissionId: result.lastInsertRowid }));
      return;
    }

    if (pathname === '/api/submissions/grade' && req.method === 'POST') {
      const { submissionId, grade, feedback } = await parseBody(req);
      dbOperations.gradeSubmission(submissionId, grade, feedback);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/submissions/student' && req.method === 'GET') {
      const submissions = dbOperations.getSubmissionsByStudent(userId);
      res.end(JSON.stringify({ success: true, submissions }));
      return;
    }

    // Message endpoints
    if (pathname.startsWith('/api/messages/')) {
      const classId = pathname.split('/')[3];

      if (req.method === 'GET') {
        const messages = dbOperations.getMessagesByClass(classId);
        res.end(JSON.stringify({ success: true, messages: messages.reverse() }));
        return;
      }

      if (req.method === 'POST') {
        const { content, receiverId } = await parseBody(req);
        const result = dbOperations.createMessage(userId, receiverId, classId, content);

        // Broadcast to online users
        wsManager.broadcastToClass(classId, {
          type: 'new_message',
          message: {
            id: result.lastInsertRowid,
            sender_id: userId,
            content,
            created_at: new Date().toISOString()
          }
        }, userId);

        res.end(JSON.stringify({ success: true, messageId: result.lastInsertRowid }));
        return;
      }
    }

    // AI endpoints
    if (pathname === '/api/ai/ask' && req.method === 'POST') {
      const { question, context } = await parseBody(req);
      const response = aiEngine.generateResponse(question, context);

      // Save AI interaction
      dbOperations.createMessage(0, userId, context.classId || null, question, false);
      dbOperations.createMessage(0, userId, context.classId || null, response.answer, true);

      res.end(JSON.stringify({ success: true, response }));
      return;
    }

    if (pathname === '/api/ai/stats' && req.method === 'GET') {
      const stats = aiEngine.getStats();
      res.end(JSON.stringify({ success: true, stats }));
      return;
    }

    if (pathname === '/api/ai/feedback' && req.method === 'POST') {
      const { question, answer, helpful } = await parseBody(req);
      aiEngine.learnFromInteraction(question, answer, helpful);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Analytics endpoints
    if (pathname === '/api/analytics/dashboard' && req.method === 'GET') {
      const user = dbOperations.getUserById(userId);
      const classes = user.role === 'student'
        ? dbOperations.getClassesByStudent(userId)
        : dbOperations.getClassesByTeacher(userId);

      const submissions = dbOperations.getSubmissionsByStudent(userId);
      const avgGrade = submissions.length > 0
        ? submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / submissions.filter(s => s.grade).length
        : 0;

      res.end(JSON.stringify({
        success: true,
        analytics: {
          totalClasses: classes.length,
          totalSubmissions: submissions.length,
          averageGrade: avgGrade.toFixed(1),
          onlineUsers: wsManager.getOnlineUsers().length,
          aiStats: aiEngine.getStats()
        }
      }));
      return;
    }

    // 404 for unknown API routes
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('API Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server error' }));
  }
}

// Serve static files
function serveStaticFile(req, res, pathname) {
  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, '../public', pathname);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('404 Not Found');
      return;
    }

    res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
    res.end(data);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    handleAPI(req, res, pathname, parsedUrl);
  } else {
    // Handle static files
    serveStaticFile(req, res, pathname);
  }
});

// WebSocket upgrade handler
server.on('upgrade', (req, socket, head) => {
  const parsedUrl = url.parse(req.url, true);
  const token = parsedUrl.query.token;

  const authResult = authModule.verifyToken(token);
  if (!authResult.valid) {
    socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
    socket.destroy();
    return;
  }

  // Accept WebSocket connection
  socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\n\\r\\n');

  wsManager.addConnection(authResult.session.userId, socket);

  socket.on('close', () => {
    wsManager.removeConnection(authResult.session.userId);
  });

  socket.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      // Handle WebSocket messages
      console.log('WebSocket message:', message);
    } catch (e) {
      console.error('WebSocket error:', e);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║  🎓 Classroom Dashboard Server         ║
  ║  ✅ Server running on port ${PORT}       ║
  ║  🌐 <http://localhost>:${PORT}             ║
  ║  🤖 AI Engine: Active                  ║
  ║  📊 Database: Connected                ║
  ╚════════════════════════════════════════╝
  `);
});
