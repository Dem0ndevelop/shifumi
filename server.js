const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const MAX_SCORE = 10;
const ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const ROOM_CODE_LENGTH = 6;
const PSEUDO_REGEX = /^[\w\sÀ-ÿ-]{2,16}$/;
const PLAYER_RECONNECT_TIMEOUT = 2 * 60 * 1000; // 2 minutes

const io = new Server(server, { cors: { origin: ALLOWED_ORIGIN } });
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

function generateRoomCode() {
    let code;
    do {
        code = [...Array(ROOM_CODE_LENGTH)].map(() => Math.random().toString(36)[2] || 'A').join('').toUpperCase();
    } while (rooms[code]);
    return code;
}

function validatePseudo(pseudo) {
    if (!pseudo || typeof pseudo !== 'string') return 'Invité';
    if (!PSEUDO_REGEX.test(pseudo)) return 'Invité';
    return pseudo;
}

io.on('connection', (socket) => {
    let currentRoom = null;
    let playerIndex = null;
    let playerPseudo = '';
    let reconnectTimer = null;

    // Envoie la liste des rooms et le leaderboard à la connexion
    broadcastRoomList();
    broadcastLeaderboard();

    socket.on('createRoom', ({ pseudo }, cb) => {
        try {
            const code = generateRoomCode();
            playerPseudo = validatePseudo(pseudo);
            rooms[code] = {
                players: [{ id: socket.id, pseudo: playerPseudo }],
                scores: { p1: 0, p2: 0, egalite: 0 },
                coups: {},
                ready: 0,
                lastActive: Date.now()
            };
            currentRoom = code;
            playerIndex = 1;
            socket.join(code);
            cb({ code, player: 1 });
            broadcastRoomList();
        } catch (e) {
            console.error('Erreur createRoom:', e);
            cb({ error: 'Erreur serveur' });
        }
    });

    socket.on('joinRoom', ({ code, pseudo }, cb) => {
        try {
            if (!rooms[code]) return cb({ error: 'Room introuvable' });
            if (rooms[code].players.length >= 2) return cb({ error: 'Salle pleine' });
            playerPseudo = validatePseudo(pseudo);
            rooms[code].players.push({ id: socket.id, pseudo: playerPseudo });
            currentRoom = code;
            playerIndex = 2;
            socket.join(code);
            cb({ code, player: 2 });
            const pseudos = rooms[code].players.map(p => p.pseudo);
            io.to(code).emit('startGame', { pseudos });
            broadcastRoomList();
        } catch (e) {
            console.error('Erreur joinRoom:', e);
            cb({ error: 'Erreur serveur' });
        }
    });

    socket.on('play', (coup) => {
        try {
            if (!currentRoom) return;
            const room = rooms[currentRoom];
            if (!room) return;
            if (!['pierre','feuille','ciseaux'].includes(coup)) return;
            room.coups['p' + playerIndex] = coup;
            room.ready++;
            room.lastActive = Date.now();
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
                if (room.scores.p1 >= MAX_SCORE || room.scores.p2 >= MAX_SCORE) {
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
        } catch (e) {
            console.error('Erreur play:', e);
        }
    });

    // Nouvelle gestion reconnexion/restauration
    socket.on('rejoinRoom', ({ code, pseudo }, cb) => {
        try {
            const room = rooms[code];
            if (!room) return cb({ error: 'Room introuvable' });
            // Chercher un joueur déconnecté avec le même pseudo
            const player = room.players.find(p => p.pseudo === pseudo && p.disconnected);
            if (!player) return cb({ error: 'Aucun joueur à restaurer' });
            player.id = socket.id;
            delete player.disconnected;
            currentRoom = code;
            playerIndex = room.players.indexOf(player) + 1;
            socket.join(code);
            cb({ code, player: playerIndex });
            const pseudos = room.players.map(p => p.pseudo);
            io.to(code).emit('startGame', { pseudos });
            broadcastRoomList();
            console.log(`[RESTORE] ${pseudo} a restauré la room ${code}`);
        } catch (e) {
            console.error('Erreur rejoinRoom:', e);
            cb({ error: 'Erreur serveur' });
        }
    });

    socket.on('disconnect', () => {
        try {
            if (currentRoom && rooms[currentRoom]) {
                // Marquer le joueur comme déconnecté
                const room = rooms[currentRoom];
                const player = room.players.find(p => p.id === socket.id);
                if (player) {
                    player.disconnected = true;
                    player.disconnectTime = Date.now();
                }
                // Si tous les joueurs sont déconnectés, supprimer la room après timeout
                if (room.players.every(p => p.disconnected)) {
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(() => {
                        if (rooms[currentRoom] && rooms[currentRoom].players.every(p => p.disconnected)) {
                            delete rooms[currentRoom];
                            broadcastRoomList();
                            console.log(`[CLEANUP] Room ${currentRoom} supprimée après timeout de reconnexion.`);
                        }
                    }, PLAYER_RECONNECT_TIMEOUT);
                } else {
                    io.to(currentRoom).emit('opponentLeft');
                }
                broadcastRoomList();
            }
        } catch (e) {
            console.error('Erreur disconnect:', e);
        }
    });

    // Gestion reconnexion (à implémenter selon besoin)
    socket.on('reconnect_attempt', () => {
        socket.emit('reconnect_info', { message: 'Tentative de reconnexion...' });
    });
});

// Nettoyage des rooms inactives
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of Object.entries(rooms)) {
        if (room.lastActive && now - room.lastActive > ROOM_TIMEOUT) {
            delete rooms[code];
        }
    }
    broadcastRoomList();
}, 60 * 1000);

server.listen(PORT, () => {
    console.log('Serveur Shifumi en ligne sur le port', PORT);
});