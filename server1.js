const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIO = require('socket.io');

const credentials = {
  key: fs.readFileSync('private.key'),
  cert: fs.readFileSync('certificate.crt')
};

const app = express();
const server = https.createServer(credentials, app);
const io = socketIO(server);

const connectedClients = [];

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    connectedClients.push(socket.id);

    socket.emit('update-user-list', { users: connectedClients });
    socket.broadcast.emit('update-user-list', { users: connectedClients });

    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
        const index = connectedClients.indexOf(socket.id);
        connectedClients.splice(index, 1);
        io.emit('update-user-list', { users: connectedClients });
    });

    socket.on('offer', (offer, target) => {
        socket.to(target).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, target) => {
        socket.to(target).emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate, target) => {
        socket.to(target).emit('ice-candidate', candidate);
    });
});

server.listen(443, '0.0.0.0', () => {
    console.log('Server running on https://localhost:3000');
});
