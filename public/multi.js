// Fichier multi.js : logique du mode multijoueur uniquement
// (issu de script.js, sans la partie solo)

const newGameBtn = document.getElementById('new-game');
const gameArea = document.getElementById('game-area');
const choicesBtns = document.querySelectorAll('.choice');
const playerScoreSpan = document.getElementById('player-score');
const computerScoreSpan = document.getElementById('computer-score');
const egaliteScoreSpan = document.getElementById('egalite-score');
const resultDiv = document.getElementById('result');
const finalResultDiv = document.getElementById('final-result');
const confettiContainer = document.getElementById('confetti-container');
const MAX_SCORE = 10;

const coups = ['pierre', 'feuille', 'ciseaux'];
const coupToText = {
    'pierre': 'Pierre',
    'feuille': 'Feuille',
    'ciseaux': 'Ciseaux'
};
const coupToImg = {
    'pierre': 'images/pierre.png',
    'feuille': 'images/feuille.png',
    'ciseaux': 'images/ciseaux.png'
};

let playerScore = 0;
let computerScore = 0;
let egaliteScore = 0;

if (document.getElementById('room-list')) {
    const socket = io();
    const roomList = document.getElementById('room-list');
    const onlineCreate = document.getElementById('online-create');
    const onlineStatus = document.getElementById('online-status');
    const onlineRoomDiv = document.getElementById('online-room');
    const onlineChoices = document.getElementById('online-choices');
    const onlineJ1 = document.getElementById('online-j1');
    const onlineJ2 = document.getElementById('online-j2');
    const pseudoInput = document.getElementById('pseudo-input');
    const leaderboardDiv = document.getElementById('leaderboard');
    const playerLabel = document.getElementById('player-label');
    const adversaireLabel = document.getElementById('adversaire-label');
    let currentRoom = null;
    let inGame = false;
    let myPlayerIndex = null;
    let hasPlayed = false;
    let waitingCoup = null;
    let myPseudo = '';
    let adversairePseudo = '';

    function renderRoomList(rooms) {
        roomList.innerHTML = '';
        if (rooms.length === 0) {
            roomList.innerHTML = '<li>Aucune partie en attente</li>';
        } else {
            rooms.forEach(({ code, pseudo }) => {
                const li = document.createElement('li');
                li.textContent = `Partie ${code} (${pseudo})`;
                const btn = document.createElement('button');
                btn.textContent = 'Rejoindre';
                btn.className = 'room-join-btn';
                if ((pseudoInput.value.trim() || 'Invité') === pseudo) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.title = 'Vous ne pouvez pas rejoindre votre propre partie';
                } else {
                    btn.onclick = () => {
                        myPseudo = pseudoInput.value.trim() || 'Invité';
                        socket.emit('joinRoom', { code, pseudo: myPseudo }, (res) => {
                            if (res.error) {
                                onlineStatus.textContent = res.error;
                            } else {
                                currentRoom = res.code;
                                myPlayerIndex = res.player;
                                inGame = true;
                                onlineRoomDiv.textContent = 'En jeu dans la partie : ' + currentRoom;
                                onlineStatus.textContent = '';
                                document.getElementById('game-area').classList.remove('hidden');
                            }
                        });
                    };
                }
                li.appendChild(btn);
                roomList.appendChild(li);
            });
        }
    }

    function renderLeaderboard(leaderboard) {
        leaderboardDiv.innerHTML = '';
        if (!leaderboard || leaderboard.length === 0) {
            leaderboardDiv.textContent = 'Aucun score pour le moment.';
            return;
        }
        // Création du tableau
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Pseudo', 'Victoires', 'Défaites'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.textAlign = 'left';
            th.style.padding = '4px 8px';
            th.style.borderBottom = '2px solid #e1b12c';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        leaderboard.forEach(({ pseudo, wins, losses }) => {
            const tr = document.createElement('tr');
            [pseudo, wins, losses].forEach(val => {
                const td = document.createElement('td');
                td.textContent = val;
                td.style.padding = '4px 8px';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        leaderboardDiv.appendChild(table);
    }

    socket.on('roomList', renderRoomList);
    socket.on('leaderboard', renderLeaderboard);

    // Sauvegarde/restauration d'état multijoueur
    function saveMultiState({ code, pseudo, player }) {
        localStorage.setItem('multi_room_code', code);
        localStorage.setItem('multi_pseudo', pseudo);
        localStorage.setItem('multi_player_index', player);
    }
    function clearMultiState() {
        localStorage.removeItem('multi_room_code');
        localStorage.removeItem('multi_pseudo');
        localStorage.removeItem('multi_player_index');
    }
    function getMultiState() {
        return {
            code: localStorage.getItem('multi_room_code'),
            pseudo: localStorage.getItem('multi_pseudo'),
            player: localStorage.getItem('multi_player_index')
        };
    }

    // Tentative de restauration automatique à l'ouverture
    window.addEventListener('DOMContentLoaded', () => {
        const state = getMultiState();
        if (state.code && state.pseudo && state.player) {
            if (confirm(`Rejoindre automatiquement la partie ${state.code} en tant que ${state.pseudo} ?`)) {
                pseudoInput.value = state.pseudo;
                myPseudo = state.pseudo;
                socket.emit('joinRoom', { code: state.code, pseudo: state.pseudo }, (res) => {
                    if (res.error) {
                        alert('Impossible de rejoindre la partie : ' + res.error);
                        clearMultiState();
                    } else {
                        currentRoom = res.code;
                        myPlayerIndex = res.player;
                        inGame = true;
                        onlineRoomDiv.textContent = 'En jeu dans la partie : ' + currentRoom;
                        onlineStatus.textContent = '';
                        document.getElementById('game-area').classList.remove('hidden');
                        saveMultiState({ code: currentRoom, pseudo: myPseudo, player: myPlayerIndex });
                    }
                });
            }
        }
    });

    // Sauvegarde lors de la création ou la jointure d'une room
    onlineCreate.onclick = () => {
        myPseudo = pseudoInput.value.trim() || 'Invité';
        socket.emit('createRoom', { pseudo: myPseudo }, ({ code, player }) => {
            currentRoom = code;
            myPlayerIndex = player;
            inGame = true;
            onlineRoomDiv.textContent = 'En attente dans la partie : ' + currentRoom;
            onlineStatus.textContent = 'En attente d\'un adversaire…';
            document.getElementById('game-area').classList.add('hidden');
            saveMultiState({ code: currentRoom, pseudo: myPseudo, player });
        });
    };
    // Sauvegarde aussi lors de la jointure via bouton "Rejoindre"
    // (déjà fait dans le callback joinRoom plus haut)

    // Nettoyage de l'état sauvegardé si la room n'existe plus ou à la déconnexion
    socket.on('opponentLeft', () => {
        onlineStatus.textContent = "L'adversaire a quitté la partie.";
        setTimeout(() => {
            clearMultiState();
            window.location.reload();
        }, 2000);
    });
    socket.on('connect_error', (err) => {
        console.error('Erreur de connexion Socket.IO:', err);
    });

    socket.on('startGame', ({ pseudos }) => {
        onlineStatus.textContent = 'Adversaire connecté !';
        document.getElementById('game-area').classList.remove('hidden');
        hasPlayed = false;
        waitingCoup = null;
        onlineChoices.style.display = 'none';
        resultDiv.textContent = '';
        choicesBtns.forEach(b => b.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
        if (pseudos) {
            playerLabel.textContent = pseudos[myPlayerIndex - 1] || 'Vous';
            adversaireLabel.textContent = pseudos[myPlayerIndex === 1 ? 1 : 0] || 'Adversaire';
            adversairePseudo = pseudos[myPlayerIndex === 1 ? 1 : 0] || '';
        }
    });

    // Gestion du coup multijoueur
    choicesBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!inGame || hasPlayed) return;
            choicesBtns.forEach(b => b.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
            btn.classList.add('selected');
            waitingCoup = btn.getAttribute('data-choice');
            socket.emit('play', waitingCoup);
            hasPlayed = true;
            resultDiv.textContent = 'En attente de l\'adversaire...';
        });
    });

    socket.on('roundResult', ({ coups, scores, gagnant }) => {
        hasPlayed = false;
        waitingCoup = null;
        onlineChoices.style.display = '';
        onlineJ1.innerHTML = `<img src="${coupToImg[coups.p1]}" alt="${coupToText[coups.p1]}"><div class="coup-label">${coupToText[coups.p1]}</div>`;
        onlineJ2.innerHTML = `<img src="${coupToImg[coups.p2]}" alt="${coupToText[coups.p2]}"><div class="coup-label">${coupToText[coups.p2]}</div>`;
        if (myPlayerIndex === 1) {
            playerScore = scores.p1;
            computerScore = scores.p2;
        } else {
            playerScore = scores.p2;
            computerScore = scores.p1;
        }
        egaliteScore = scores.egalite;
        let isMeWinner = (gagnant === 'p1' && myPlayerIndex === 1) || (gagnant === 'p2' && myPlayerIndex === 2);
        let isMeLoser = (gagnant === 'p1' && myPlayerIndex === 2) || (gagnant === 'p2' && myPlayerIndex === 1);
        updateScores(true, isMeWinner ? 'player' : isMeLoser ? 'computer' : 'egalite');
        resultDiv.classList.remove('gagne', 'perdu', 'egalite');
        if (gagnant === 'p1' || gagnant === 'p2') {
            resultDiv.textContent = isMeWinner ? 'Vous remportez la manche !' : (adversairePseudo ? adversairePseudo + ' remporte la manche !' : 'Adversaire remporte la manche !');
            resultDiv.classList.add(isMeWinner ? 'gagne' : 'perdu');
            if (isMeWinner) launchConfetti();
        } else {
            resultDiv.textContent = 'Égalité.';
            resultDiv.classList.add('egalite');
        }
        if (playerScore >= MAX_SCORE || computerScore >= MAX_SCORE) {
            setTimeout(endGame, 1200);
        } else {
            setTimeout(() => {
                onlineChoices.style.display = 'none';
                resultDiv.textContent = '';
                choicesBtns.forEach(b => b.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
                clearConfetti();
            }, 1200);
        }
    });

    // Gestion modale classement
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const leaderboardModal = document.getElementById('leaderboard-modal');
    const closeLeaderboard = document.getElementById('close-leaderboard');
    leaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.add('open');
    });
    closeLeaderboard.addEventListener('click', () => {
        leaderboardModal.classList.remove('open');
    });
    leaderboardModal.addEventListener('click', (e) => {
        if (e.target === leaderboardModal) leaderboardModal.classList.remove('open');
    });

    // Pseudo localStorage
    if (localStorage.getItem('pseudo')) {
        pseudoInput.value = localStorage.getItem('pseudo');
    }
    pseudoInput.addEventListener('input', () => {
        localStorage.setItem('pseudo', pseudoInput.value.trim());
    });
}

function updateScores(animate = false, winner = null) {
    playerScoreSpan.textContent = playerScore;
    computerScoreSpan.textContent = computerScore;
    egaliteScoreSpan.textContent = egaliteScore;
    if (animate) {
        if (winner === 'player') {
            playerScoreSpan.classList.add('score-animate-player');
            setTimeout(() => playerScoreSpan.classList.remove('score-animate-player'), 700);
        } else if (winner === 'computer') {
            computerScoreSpan.classList.add('score-animate-computer');
            setTimeout(() => computerScoreSpan.classList.remove('score-animate-computer'), 700);
        } else if (winner === 'egalite') {
            egaliteScoreSpan.classList.add('score-animate-egalite');
            setTimeout(() => egaliteScoreSpan.classList.remove('score-animate-egalite'), 700);
        }
    }
}

function endGame() {
    canPlay = false;
    gameArea.classList.add('hidden');
    finalResultDiv.classList.remove('hidden');
    if (playerScore > computerScore) {
        finalResultDiv.textContent = `Bravo ! Vous avez gagné la partie ${playerScore} à ${computerScore} !`;
    } else if (playerScore < computerScore) {
        finalResultDiv.textContent = `Dommage... L'adversaire a gagné ${computerScore} à ${playerScore}.`;
    } else {
        finalResultDiv.textContent = `Égalité parfaite ! (${playerScore} partout)`;
    }
}

function launchConfetti() {
    clearConfetti();
    for (let i = 0; i < 80; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.background = `hsl(${Math.random()*360}, 80%, 60%)`;
        conf.style.animationDuration = (1.5 + Math.random()) + 's';
        confettiContainer.appendChild(conf);
    }
    setTimeout(clearConfetti, 5000); // cooldown 5s max
}

function clearConfetti() {
    confettiContainer.innerHTML = '';
}

// Gestion de la modale des règles
const rulesBtn = document.getElementById('rules-btn');
const rulesModal = document.getElementById('rules-modal');
const closeRules = document.getElementById('close-rules');
rulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('open');
});
closeRules.addEventListener('click', () => {
    rulesModal.classList.remove('open');
});
rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
        rulesModal.classList.remove('open');
    }
});

window.onload = () => {
    gameArea.classList.add('hidden');
    finalResultDiv.classList.add('hidden');
};

newGameBtn.addEventListener('click', () => {
    playerScore = 0;
    computerScore = 0;
    egaliteScore = 0;
    updateScores();
    resultDiv.textContent = '';
    finalResultDiv.classList.add('hidden');
    gameArea.classList.remove('hidden');
    choicesBtns.forEach(btn => btn.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
    clearConfetti();
}); 