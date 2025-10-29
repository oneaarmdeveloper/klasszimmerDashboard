//Realtime features with Websocket

//Connection manager
class WebSocketManager {
    constructor() {
        this.connections = new Map();
    }

    addConnection(userId, ws) {
        this.connections.set(userId, ws);
        console.log(`User ${userId} connected through websocket`);
    }

    removeConnection(userId) {
        this.connections.delete(userId);
        console.log(`User ${userId} disconnected`);
    }

    broadcast(data, excludeUserId = null) {
        this.connections.forEach((ws, userId) => {
            if (userId !== excludeUserId && ws.readyState === 1) { // 1 = OPEN
                ws.send(JSON.stringify(data));
            }
        });
    }

    broadcastToClass(classId, data, excludeUserId = null) {
        // TODO: Filter connections by classId if you store class info
        // For now, broadcasts to all users
        this.broadcast(data, excludeUserId);
    }

    getOnlineUsers() {
        return Array.from(this.connections.keys());
    }
}

const wsManager = new WebSocketManager();

module.exports = wsManager;