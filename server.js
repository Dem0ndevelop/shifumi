const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Sert les fichiers statiques (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Structure : { roomCode: { players: [socketId, ...], scores: {p1, p2, egalite}, coups: {p1, p2}, ready: 0/1/2 } }
const rooms = {};

function getOpponent(room, socketId) {
    return rooms[room]?.players.find(id => id !== socketId);
}

// Envoie la liste des rooms en attente à tous les clients
function broadcastRoomList() {
    const waitingRooms = Object.entries(rooms)
        .filter(([code, room]) => room.players.length === 1)
        .map(([code]) => code);
    io.emit('roomList', waitingRooms);
}

io.on('connection', (socket) => {
    let currentRoom = null;
    let playerIndex = null;

    // Envoie la liste des rooms à la connexion
    broadcastRoomList();

    socket.on('getRoomList', () => {
        broadcastRoomList();
    });

    socket.on('createRoom', (cb) => {
        let code;
        do {
            code = Math.random().toString(36).substr(2, 5).toUpperCase();
        } while (rooms[code]);
        rooms[code] = {
            players: [socket.id],
            scores: { p1: 0, p2: 0, egalite: 0 },
            coups: {},
            ready: 0
        };
        currentRoom = code;
        playerIndex = 1;
        socket.join(code);
        cb({ code, player: 1 });
        broadcastRoomList();
    });

    socket.on('joinRoom', (code, cb) => {
        if (!rooms[code]) return cb({ error: 'Room introuvable' });
        if (rooms[code].players.length >= 2) return cb({ error: 'Salle pleine' });
        rooms[code].players.push(socket.id);
        currentRoom = code;
        playerIndex = 2;
        socket.join(code);
        cb({ code, player: 2 });
        io.to(code).emit('startGame');
        broadcastRoomList();
    });

    socket.on('play', (coup) => {
        if (!currentRoom) return;
        const room = rooms[currentRoom];
        if (!room) return;
        room.coups['p' + playerIndex] = coup;
        room.ready++;
        if (room.ready === 2) {
            // Résoudre la manche
            const c1 = room.coups.p1;
            const c2 = room.coups.p2;
            let res;
            if (c1 === c2) {
                res = 'egalite';
                room.scores.egalite++;
            } else if (
                (c1 === 'pierre' && c2 === 'ciseaux') ||
                (c1 === 'feuille' && c2 === 'pierre') ||
                (c1 === 'ciseaux' && c2 === 'feuille')
            ) {
                res = 'p1';
                room.scores.p1++;
            } else {
                res = 'p2';
                room.scores.p2++;
            }
            io.to(currentRoom).emit('roundResult', {
                coups: { p1: c1, p2: c2 },
                scores: room.scores,
                gagnant: res
            });
            room.coups = {};
            room.ready = 0;
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players = rooms[currentRoom].players.filter(id => id !== socket.id);
            if (rooms[currentRoom].players.length === 0) {
                delete rooms[currentRoom];
            } else {
                io.to(currentRoom).emit('opponentLeft');
            }
            broadcastRoomList();
        }
    });
});

server.listen(PORT, () => {
    console.log('Serveur Shifumi en ligne sur le port', PORT);
}); 