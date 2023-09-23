const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIO = require('socket.io');
const multer  = require('multer');

const upload = multer({ dest: 'uploads/' });

const credentials = {
  key: fs.readFileSync('private.key'),
  cert: fs.readFileSync('certificate.crt')
};

const app = express();
const server = https.createServer(credentials, app);
const io = socketIO(server);

app.use(express.static(__dirname));

// Handle video upload
app.post('/upload', upload.single('video'), (req, res) => {
    console.log('Video uploaded:', req.file.path);
    res.status(200).send('Video uploaded');
});

io.on('connection', (socket) => {
    // Inform all clients about the new user
    io.sockets.emit('user-connected', { socketId: socket.id });

    // On disconnection, inform all clients about the user's departure
    socket.on('disconnect', () => {
        io.sockets.emit('user-disconnected', { socketId: socket.id });
    });

    // Handling offer, answer, and ICE candidates
    socket.on('send-offer', (targetSocketId, offer) => {
        socket.to(targetSocketId).emit('receive-offer', socket.id, offer);
    });

    socket.on('send-answer', (targetSocketId, answer) => {
        socket.to(targetSocketId).emit('receive-answer', answer);
    });

    socket.on('send-ice-candidate', (targetSocketId, iceCandidate) => {
        socket.to(targetSocketId).emit('receive-ice-candidate', iceCandidate);
    });
});

server.listen(443, '0.0.0.0', () => {
    console.log('Server running on https://localhost:3000');
});
