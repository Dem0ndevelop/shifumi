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

// Structure améliorée avec pseudos
// { roomCode: { players: [{id, pseudo}, ...], scores: {p1, p2, egalite}, coups: {p1, p2}, ready: 0/1/2 } }
const rooms = {};
const leaderboard = new Map(); // pseudo -> {wins, losses}

function getOpponent(room, socketId) {
    return rooms[room]?.players.find(player => player.id !== socketId);
}

// Envoie la liste des rooms en attente à tous les clients
function broadcastRoomList() {
    const waitingRooms = Object.entries(rooms)
        .filter(([code, room]) => room.players.length === 1)
        .map(([code, room]) => ({
            code,
            pseudo: room.players[0].pseudo
        }));
    io.emit('roomList', waitingRooms);
}

function broadcastLeaderboard() {
    const leaderboardArray = Array.from(leaderboard.entries())
        .map(([pseudo, stats]) => ({ pseudo, wins: stats.wins, losses: stats.losses }))
        .sort((a, b) => b.wins - a.wins);
    io.emit('leaderboard', leaderboardArray);
}

function updateLeaderboard(winnerPseudo, loserPseudo) {
    if (!leaderboard.has(winnerPseudo)) {
        leaderboard.set(winnerPseudo, { wins: 0, losses: 0 });
    }
    if (!leaderboard.has(loserPseudo)) {
        leaderboard.set(loserPseudo, { wins: 0, losses: 0 });
    }
    
    leaderboard.get(winnerPseudo).wins++;
    leaderboard.get(loserPseudo).losses++;
    broadcastLeaderboard();
}

io.on('connection', (socket) => {
    let currentRoom = null;
    let playerIndex = null;
    let playerPseudo = '';

    // Envoie la liste des rooms et le leaderboard à la connexion
    broadcastRoomList();
    broadcastLeaderboard();

    socket.on('createRoom', ({ pseudo }, cb) => {
        let code;
        do {
            code = Math.random().toString(36).substr(2, 5).toUpperCase();
        } while (rooms[code]);

        playerPseudo = pseudo || 'Invité';
        rooms[code] = {
            players: [{ id: socket.id, pseudo: playerPseudo }],
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

    socket.on('joinRoom', ({ code, pseudo }, cb) => {
        if (!rooms[code]) return cb({ error: 'Room introuvable' });
        if (rooms[code].players.length >= 2) return cb({ error: 'Salle pleine' });

        playerPseudo = pseudo || 'Invité';
        rooms[code].players.push({ id: socket.id, pseudo: playerPseudo });
        currentRoom = code;
        playerIndex = 2;
        socket.join(code);
        cb({ code, player: 2 });

        // Envoie les pseudos aux deux joueurs
        const pseudos = rooms[code].players.map(p => p.pseudo);
        io.to(code).emit('startGame', { pseudos });
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

            // Vérifier fin de partie (score max atteint)
            const maxScore = 10;
            if (room.scores.p1 >= maxScore || room.scores.p2 >= maxScore) {
                // Mettre à jour le leaderboard
                const player1 = room.players[0];
                const player2 = room.players[1];
                
                if (room.scores.p1 > room.scores.p2) {
                    updateLeaderboard(player1.pseudo, player2.pseudo);
                } else if (room.scores.p2 > room.scores.p1) {
                    updateLeaderboard(player2.pseudo, player1.pseudo);
                }
                // Pas de mise à jour pour égalité
            }

            room.coups = {};
            room.ready = 0;
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players = rooms[currentRoom].players.filter(player => player.id !== socket.id);
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