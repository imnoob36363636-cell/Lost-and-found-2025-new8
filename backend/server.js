// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRequestRoutes = require('./routes/chatRequestRoutes');

const app = express();
const server = http.createServer(app);

// Socket.IO with CORS allowed for all origins
const io = new Server(server, {
  cors: {
    origin: '*', // allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  },
});

// connect to DB
connectDB();

// Express CORS - allow all origins
app.use(
  cors({
    origin: '*', // allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'NIT KKR Lost & Found API' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat-requests', chatRequestRoutes);

// Simple map userId -> socketId
const userSocketMap = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // register the userId with current socket id
  socket.on('register', (userId) => {
    if (!userId) return;
    userSocketMap.set(userId, socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  // sending a message to a specific recipient
  socket.on('send_message', (data) => {
    try {
      const { recipientId, message } = data;
      if (!recipientId) return;
      const recipientSocketId = userSocketMap.get(recipientId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_message', message);
      } else {
        // optionally: store undelivered message to DB or notify sender
        console.log(`Recipient ${recipientId} not connected`);
      }
    } catch (err) {
      console.error('send_message error:', err);
    }
  });

  // typing indicator
  socket.on('typing', (data) => {
    try {
      const { recipientId, isTyping } = data;
      if (!recipientId) return;
      const recipientSocketId = userSocketMap.get(recipientId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user_typing', { isTyping });
      }
    } catch (err) {
      console.error('typing error:', err);
    }
  });

  socket.on('disconnect', () => {
    // remove any user mapped to this socket id
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// error handler (should be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
