// real-chat.js
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  const user = req.query.user;
  const room = req.query.room;
  res.render('real-chat.ejs', { user, room });
});

const setupDatabase = async () => {
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      content TEXT,
      room TEXT
    );
  `);

  return db;
};

const db = await setupDatabase();

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join-room', (data) => {
    const { sender, room } = data;
    socket.join(room);
    console.log(`User ${sender} joined room ${room}`);
  });

  socket.on('fetch-messages', async (room) => {
    try {
      const messages = await db.all('SELECT sender, content FROM messages WHERE room = ?', room);
      socket.emit('load-messages', messages);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  });

  socket.on('message', async (data) => {
    try {
      await db.run('INSERT INTO messages (sender, content, room) VALUES (?, ?, ?)', data.sender, data.message, data.room);
      io.to(data.room).emit('message', data); // Broadcast the message to the other user in the room
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
