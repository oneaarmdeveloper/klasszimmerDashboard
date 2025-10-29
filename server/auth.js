const crypto = require('crypto');
const { dbOperation, dbOperations } = require('./database');

// Hash password using SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Session key generation
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Store Active Sessions in memory
const sessions = new Map();

const authModule = {
    // Register new user
    register: (username, password, email, role, fullName) => {
        try {
            const hashedPassword = hashPassword(password);
            const result = dbOperations.createUser(username, hashedPassword, email, role, fullName);
            return { success: true, userId: result.lastInsertRowid };
        } catch (error) {
            return { success: false, error: 'Username or email already exists' };
        }
    },

    // Login user
    login: (username, password) => {
        const hashedPassword = hashPassword(password);
        const user = dbOperations.getUserByUsername(username);

        if (!user || user.password !== hashedPassword) {
            return { success: false, error: 'Invalid credentials' };
        }

        dbOperations.updateLastLogin(user.id);

        // Session creation
        const token = generateToken();
        sessions.set(token, {
            userId: user.id,
            username: user.username,
            role: user.role,
            createdAt: Date.now()
        });

        return {
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                fullName: user.full_name
            }
        };
    },

    // Session token verification
    verifyToken: (token) => {
        const session = sessions.get(token);
        if (!session) {
            return { valid: false };
        }

        // Session expires after 24 hours
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (Date.now() - session.createdAt > twentyFourHours) {
            sessions.delete(token);
            return { valid: false };
        }

        return { valid: true, session };
    },

    // Logout user
    logout: (token) => {
        sessions.delete(token);
        return { success: true };
    },

    // Count Active sessions
    getActiveSessionsCount: () => {
        return sessions.size;
    }
};

module.exports = authModule;