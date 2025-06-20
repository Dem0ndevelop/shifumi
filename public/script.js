const newGameBtn = document.getElementById('new-game');
const gameArea = document.getElementById('game-area');
const choicesBtns = document.querySelectorAll('.choice');
const playerScoreSpan = document.getElementById('player-score');
const computerScoreSpan = document.getElementById('computer-score');
const egaliteScoreSpan = document.getElementById('egalite-score');
const resultDiv = document.getElementById('result');
const finalResultDiv = document.getElementById('final-result');
const computerChoiceSquare = document.getElementById('computer-choice-square');
const confettiContainer = document.getElementById('confetti-container');

const maxScore = 10;
let playerScore = 0;
let computerScore = 0;
let egaliteScore = 0;
let canPlay = true;

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

function resetGame() {
    playerScore = 0;
    computerScore = 0;
    egaliteScore = 0;
    updateScores();
    resultDiv.textContent = '';
    finalResultDiv.classList.add('hidden');
    gameArea.classList.remove('hidden');
    canPlay = true;
    choicesBtns.forEach(btn => btn.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
    computerChoiceSquare.innerHTML = '';
    clearConfetti();
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

function getComputerChoice() {
    return coups[Math.floor(Math.random() * coups.length)];
}

function getResult(player, computer) {
    if (player === computer) return 'Égalité';
    if (
        (player === 'pierre' && computer === 'ciseaux') ||
        (player === 'feuille' && computer === 'pierre') ||
        (player === 'ciseaux' && computer === 'feuille')
    ) {
        return 'Gagné';
    }
    return 'Perdu';
}

function endGame() {
    canPlay = false;
    gameArea.classList.add('hidden');
    finalResultDiv.classList.remove('hidden');
    if (playerScore > computerScore) {
        finalResultDiv.textContent = `Bravo ! Vous avez gagné la partie ${playerScore} à ${computerScore} !`;
    } else {
        finalResultDiv.textContent = `Dommage... L'ordinateur a gagné ${computerScore} à ${playerScore}.`;
    }
}

if (!document.getElementById('room-list')) {
    // === Mode solo/local uniquement ===
    choicesBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!canPlay) return;
            canPlay = false;
            choicesBtns.forEach(b => b.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
            btn.classList.add('selected');
            resultDiv.textContent = '';
            computerChoiceSquare.innerHTML = '';
            setTimeout(() => {
                const playerChoice = btn.getAttribute('data-choice');
                const computerChoice = getComputerChoice();
                computerChoiceSquare.innerHTML = `<img src="${coupToImg[computerChoice]}" alt="${coupToText[computerChoice]}"><div class="coup-label">${coupToText[computerChoice]}</div>`;
                choicesBtns.forEach(b => {
                    if (b !== btn) b.classList.add('gris');
                });
                btn.classList.add('selected');
                const res = getResult(playerChoice, computerChoice);
                resultDiv.classList.remove('gagne', 'perdu', 'egalite');
                if (res === 'Gagné') {
                    playerScore++;
                    resultDiv.textContent = 'Vous remportez la manche !';
                    resultDiv.classList.add('gagne');
                    btn.classList.add('gagnant');
                    updateScores(true, 'player');
                    launchConfetti();
                } else if (res === 'Perdu') {
                    computerScore++;
                    resultDiv.textContent = "L'ordinateur remporte la manche.";
                    resultDiv.classList.add('perdu');
                    btn.classList.add('perdant');
                    updateScores(true, 'computer');
                } else {
                    egaliteScore++;
                    resultDiv.textContent = 'Égalité.';
                    resultDiv.classList.add('egalite');
                    btn.classList.add('gris');
                    updateScores(true, 'egalite');
                }
                if (playerScore >= maxScore || computerScore >= maxScore) {
                    setTimeout(endGame, 1200);
                } else {
                    setTimeout(() => {
                        canPlay = true;
                        choicesBtns.forEach(b => b.classList.remove('selected', 'gagnant', 'perdant', 'gris'));
                        computerChoiceSquare.innerHTML = '';
                        clearConfetti();
                    }, 1000);
                }
            }, 1200);
        });
    });

    // Gestion modale classement
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const leaderboardModal = document.getElementById('leaderboard-modal');
    const closeLeaderboard = document.getElementById('close-leaderboard');
    const leaderboardDiv = document.getElementById('leaderboard');
    leaderboardBtn.addEventListener('click', () => {
        renderSoloLeaderboard();
        leaderboardModal.classList.add('open');
    });
    closeLeaderboard.addEventListener('click', () => {
        leaderboardModal.classList.remove('open');
    });
    leaderboardModal.addEventListener('click', (e) => {
        if (e.target === leaderboardModal) leaderboardModal.classList.remove('open');
    });

    // Pseudo solo (localStorage)
    let soloPseudo = localStorage.getItem('pseudo') || 'Joueur';

    // Classement solo : structure [{pseudo, wins, losses}]
    function getSoloLeaderboard() {
        return JSON.parse(localStorage.getItem('soloLeaderboard') || '[]');
    }
    function saveSoloLeaderboard(leaderboard) {
        localStorage.setItem('soloLeaderboard', JSON.stringify(leaderboard));
    }
    function updateSoloLeaderboard(isWin) {
        let leaderboard = getSoloLeaderboard();
        let entry = leaderboard.find(e => e.pseudo === soloPseudo);
        if (!entry) {
            entry = { pseudo: soloPseudo, wins: 0, losses: 0 };
            leaderboard.push(entry);
        }
        if (isWin === true) entry.wins++;
        if (isWin === false) entry.losses++;
        saveSoloLeaderboard(leaderboard);
    }
    function renderSoloLeaderboard() {
        leaderboardDiv.innerHTML = '';
        const leaderboard = getSoloLeaderboard();
        if (!leaderboard.length) {
            leaderboardDiv.textContent = 'Aucun score pour le moment.';
            return;
        }
        // Tableau
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

    // Ajout mise à jour classement à la fin de partie solo
    const oldEndGame = endGame;
    endGame = function() {
        if (playerScore > computerScore) updateSoloLeaderboard(true);
        else if (playerScore < computerScore) updateSoloLeaderboard(false);
        oldEndGame();
    };
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

newGameBtn.addEventListener('click', resetGame);

// === Mode multijoueur avec liste de parties ===
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

    onlineCreate.onclick = () => {
        myPseudo = pseudoInput.value.trim() || 'Invité';
        socket.emit('createRoom', { pseudo: myPseudo }, ({ code, player }) => {
            currentRoom = code;
            myPlayerIndex = player;
            inGame = true;
            onlineRoomDiv.textContent = 'En attente dans la partie : ' + currentRoom;
            onlineStatus.textContent = 'En attente d\'un adversaire…';
            document.getElementById('game-area').classList.add('hidden');
        });
    };

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

    socket.on('opponentLeft', () => {
        onlineStatus.textContent = "L'adversaire a quitté la partie.";
        setTimeout(() => window.location.reload(), 2000);
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
        playerScore = scores.p1;
        computerScore = scores.p2;
        egaliteScore = scores.egalite;
        updateScores(true, gagnant === 'p1' ? 'player' : gagnant === 'p2' ? 'computer' : 'egalite');
        resultDiv.classList.remove('gagne', 'perdu', 'egalite');
        let isMeWinner = (gagnant === 'p1' && myPlayerIndex === 1) || (gagnant === 'p2' && myPlayerIndex === 2);
        let isMeLoser = (gagnant === 'p1' && myPlayerIndex === 2) || (gagnant === 'p2' && myPlayerIndex === 1);
        if (gagnant === 'p1' || gagnant === 'p2') {
            resultDiv.textContent = isMeWinner ? 'Vous remportez la manche !' : (adversairePseudo ? adversairePseudo + ' remporte la manche !' : 'Adversaire remporte la manche !');
            resultDiv.classList.add(isMeWinner ? 'gagne' : 'perdu');
            if (isMeWinner) launchConfetti();
        } else {
            resultDiv.textContent = 'Égalité.';
            resultDiv.classList.add('egalite');
        }
        if (playerScore >= maxScore || computerScore >= maxScore) {
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