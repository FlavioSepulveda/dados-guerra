/* ==========================================================================
   1. MOTOR DE ÁUDIO SINTETIZADO (Web Audio API)
   Gera sons orgânicos de madeira/dado sem depender de arquivos externos.
   ========================================================================== */
const sfx = (() => {
    let ctx = null;
    let muted = false;

    function init() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
    }

    function playTone(freq, type, duration, vol = 0.08, delay = 0) {
        if (muted) return;
        init();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

        gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
    }

    return {
        toggle() {
            muted = !muted;
            return !muted;
        },
        // Clique seco de dado girando na madeira
        tick() {
            playTone(170 + Math.random() * 90, 'triangle', 0.04, 0.05);
        },
        // Impacto abafado do dado caindo no feltro
        land() {
            playTone(105, 'sine', 0.14, 0.15);
        },
        // Acorde curto ao marcar ponto
        point() {
            playTone(392.00, 'triangle', 0.16, 0.1);        // Sol
            playTone(493.88, 'triangle', 0.24, 0.1, 0.09);  // Si
        },
        // Fanfarra de empate especial (3+3 ou 6+6)
        special() {
            playTone(440.00, 'triangle', 0.15, 0.1);
            playTone(554.37, 'triangle', 0.15, 0.1, 0.08);
            playTone(659.25, 'triangle', 0.28, 0.12, 0.16);
        },
        // Som grave de penalidade (1+1)
        loss() {
            playTone(196.00, 'sawtooth', 0.18, 0.06);
            playTone(146.83, 'sawtooth', 0.26, 0.06, 0.12);
        },
        // Fanfarra de vitória
        win() {
            const notes = [392.00, 493.88, 587.33, 783.99];
            notes.forEach((freq, idx) => {
                playTone(freq, 'triangle', 0.28, 0.12, idx * 0.11);
            });
        }
    };
})();


/* ==========================================================================
   2. ESTADO GLOBAL E REFERÊNCIAS DO DOM
   ========================================================================== */
const state = {
    score1: 0,
    score2: 0,
    diceCount: 1,
    round: 0,
    maxScore: 7,
    gameOver: false,
    rolling: false,
};

const els = {
    score1:          document.getElementById('score1'),
    score2:          document.getElementById('score2'),
    pips1:           document.getElementById('pips1'),
    pips2:           document.getElementById('pips2'),
    diceCount1:      document.getElementById('diceCount1'),
    diceCount2:      document.getElementById('diceCount2'),
    dice1:           document.getElementById('dice1'),
    dice2:           document.getElementById('dice2'),
    total1:          document.getElementById('total1'),
    total2:          document.getElementById('total2'),
    message:         document.getElementById('message'),
    rollBtn:         document.getElementById('rollBtn'),
    restartBtn:      document.getElementById('restartBtn'),
    log:             document.getElementById('log'),
    roundCounter:    document.getElementById('roundCounter'),
    overlay:         document.getElementById('overlay'),
    winnerText:      document.getElementById('winnerText'),
    winnerSub:       document.getElementById('winnerSub'),
    p1card:          document.getElementById('p1card'),
    p2card:          document.getElementById('p2card'),
    ropeKnot:        document.getElementById('ropeKnot'),
    arena:           document.getElementById('arena'),
    specialPopup:    document.getElementById('specialPopup'),
    specialPopupBox: document.getElementById('specialPopupBox'),
    soundToggle:     document.getElementById('soundToggle'),
};

// Mapeamento das 9 posições da grade 3x3 para cada face do dado (1 a 6)
const FACE_MAP = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
};


/* ==========================================================================
   3. CONSTRUÇÃO E ANIMAÇÃO DOS DADOS
   ========================================================================== */

/** Retorna um número inteiro aleatório entre 1 e 6 */
function randDie() {
    return Math.ceil(Math.random() * 6);
}

/** Cria o elemento HTML de um dado com suas 9 células de pintas */
function makeDie(value, player) {
    const die = document.createElement('div');
    die.className = `die ${player === 1 ? 'p1' : 'p2'}`;

    const activePips = FACE_MAP[value] || [];
    for (let i = 1; i <= 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip ' + (activePips.includes(i) ? 'on' : 'off');
        die.appendChild(pip);
    }

    die.dataset.value = value;
    return die;
}

/** Atualiza a face exibida de um dado existente */
function setFace(die, value) {
    const activePips = FACE_MAP[value];
    die.querySelectorAll('.pip').forEach((pip, index) => {
        const position = index + 1;
        pip.classList.toggle('on', activePips.includes(position));
        pip.classList.toggle('off', !activePips.includes(position));
    });
    die.dataset.value = value;
}

/**
 * Renderiza e anima os dados de um jogador na mesa de feltro.
 * @param {HTMLElement} container - Div onde os dados serão inseridos
 * @param {number[]} finalValues - Valores sorteados para esta rodada
 * @param {number} player - 1 ou 2
 * @param {boolean} playTicks - Define se este lote dispara os efeitos sonoros
 */
function animateDiceInto(container, finalValues, player, playTicks = false) {
    container.innerHTML = '';
    container.classList.toggle('dice-crowded', finalValues.length >= 5);

    finalValues.forEach((finalVal, idx) => {
        const die = makeDie(randDie(), player);
        const delay = idx * 75;

        die.style.animationDelay = `${delay}ms`;
        die.classList.add('animate-die-tumble');
        container.appendChild(die);

        // Alterna faces rapidamente enquanto o dado gira
        const faceTimer = setInterval(() => {
            setFace(die, randDie());
            if (playTicks && idx === 0) sfx.tick();
        }, 65);

        // Para a rolagem, fixa o número sorteado e aplica o impacto no feltro
        setTimeout(() => {
            clearInterval(faceTimer);
            setFace(die, finalVal);
            if (playTicks && idx === 0) sfx.land();

            die.style.animationDelay = '0ms';
            die.classList.remove('animate-die-tumble');
            void die.offsetWidth; // Força reflow para reiniciar animação
            die.classList.add('animate-die-land');

            // Destaca borda se for um número especial (1, 3 ou 6)
            if ([1, 3, 6].includes(finalVal)) {
                die.classList.add(`special-${finalVal}`);
            }
        }, 550 + delay);
    });
}


/* ==========================================================================
   4. FLUXO DA RODADA E REGRAS DO JOGO
   ========================================================================== */

/** Executa uma rodada completa ao clicar no botão ou apertar Espaço */
function rollDice() {
    if (state.gameOver || state.rolling) return;

    state.rolling = true;
    state.round++;
    els.roundCounter.textContent = `Rodada ${state.round}`;

    // Limpa brilhos da rodada anterior
    document.querySelectorAll('.die').forEach(d => {
        d.classList.remove(
            'special-1', 'special-3', 'special-6',
            'animate-glow-red', 'animate-glow-pulse', 'animate-glow-blue'
        );
    });

    els.rollBtn.disabled = true;
    els.message.textContent = '🎲 Rolando os dados na mesa...';
    els.total1.classList.add('opacity-0');
    els.total2.classList.add('opacity-0');

    // Sorteia os dados de cada jogador
    const rolls1 = Array.from({ length: state.diceCount }, randDie);
    const rolls2 = Array.from({ length: state.diceCount }, randDie);
    const total1 = rolls1.reduce((acc, val) => acc + val, 0);
    const total2 = rolls2.reduce((acc, val) => acc + val, 0);

    animateDiceInto(els.dice1, rolls1, 1, true);
    animateDiceInto(els.dice2, rolls2, 2, false);

    const revealTime = 650 + (state.diceCount - 1) * 75;

    // Exibe a soma de cada jogador
    setTimeout(() => {
        els.total1.textContent = `Soma: ${total1}`;
        els.total2.textContent = `Soma: ${total2}`;
        els.total1.classList.remove('opacity-0');
        els.total2.classList.remove('opacity-0');
    }, revealTime);

    // Avalia o resultado da rodada
    setTimeout(() => {
        applyRules(rolls1, rolls2, total1, total2);
        state.rolling = false;
        if (!state.gameOver) els.rollBtn.disabled = false;
    }, revealTime + 320);
}

/** Verifica regras especiais (1+1, 3+3, 6+6) ou comparação normal de soma */
function applyRules(rolls1, rolls2, total1, total2) {
    let msg = '';

    const bothRolled1 = rolls1.includes(1) && rolls2.includes(1);
    const bothRolled3 = rolls1.includes(3) && rolls2.includes(3);
    const bothRolled6 = rolls1.includes(6) && rolls2.includes(6);

    const highlightDice = (container, targetValue) => {
        Array.from(container.children).forEach(die => {
            if (parseInt(die.dataset.value, 10) === targetValue) {
                const glowClass =
                    targetValue === 1 ? 'animate-glow-red' :
                    targetValue === 3 ? 'animate-glow-pulse' : 'animate-glow-blue';
                die.classList.add(`special-${targetValue}`, glowClass);
            }
        });
    };

    if (bothRolled1) {
        state.score1 = Math.max(0, state.score1 - 1);
        state.score2 = Math.max(0, state.score2 - 1);
        msg = '😱 Azar duplo no 1! Ambos perdem 1 ponto.';
        popScore(els.score1, -1);
        popScore(els.score2, -1);
        addLog(`R${state.round}: [${rolls1.join('+')}] vs [${rolls2.join('+')}] → 1+1 (ambos −1)`, 'loss');
        highlightDice(els.dice1, 1);
        highlightDice(els.dice2, 1);
        showSpecialPopup('1 + 1 = −1 PONTO', 'text-red-400', 'border-red-500/80');
        sfx.loss();

    } else if (bothRolled3) {
        state.score1 = Math.min(state.maxScore, state.score1 + 1);
        state.score2 = Math.min(state.maxScore, state.score2 + 1);
        msg = '✨ Sorte dupla no 3! Ambos ganham 1 ponto.';
        popScore(els.score1, +1);
        popScore(els.score2, +1);
        addLog(`R${state.round}: [${rolls1.join('+')}] vs [${rolls2.join('+')}] → 3+3 (ambos +1)`, 'special');
        highlightDice(els.dice1, 3);
        highlightDice(els.dice2, 3);
        showSpecialPopup('3 + 3 = +1 PONTO', 'text-amber-300', 'border-amber-400/80');
        sfx.special();

    } else if (bothRolled6) {
        state.diceCount++;
        msg = `🎲 Duplo 6 na mesa! +1 dado para cada (${state.diceCount} dados).`;
        addLog(`R${state.round}: [${rolls1.join('+')}] vs [${rolls2.join('+')}] → 6+6 (+1 dado)`, 'special');
        highlightDice(els.dice1, 6);
        highlightDice(els.dice2, 6);
        showSpecialPopup('6 + 6 = +1 DADO!', 'text-sky-300', 'border-sky-400/80');
        sfx.special();

    } else if (total1 > total2) {
        state.score1++;
        msg = `🔴 Jogador 1 puxou a corda! (${total1} > ${total2})`;
        popScore(els.score1, +1);
        addLog(`R${state.round}: ${total1} vs ${total2} → J1 +1`);
        sfx.point();

    } else if (total2 > total1) {
        state.score2++;
        msg = `🔵 Jogador 2 puxou a corda! (${total2} > ${total1})`;
        popScore(els.score2, +1);
        addLog(`R${state.round}: ${total1} vs ${total2} → J2 +1`);
        sfx.point();

    } else {
        msg = `🤝 Empate na soma (${total1} = ${total2}). A corda não se move.`;
        addLog(`R${state.round}: ${total1} vs ${total2} → empate`);
    }

    updateUI(msg);
    checkWinner();
}


/* ==========================================================================
   5. ATUALIZAÇÃO DE INTERFACE, POPUPS E VITÓRIA
   ========================================================================== */

/** Exibe o banner central de evento especial e treme a mesa */
function showSpecialPopup(text, textClass, borderClass) {
    els.specialPopupBox.className = `px-6 sm:px-9 py-3.5 sm:py-4 rounded-2xl font-classic font-black text-2xl sm:text-4xl md:text-5xl text-center shadow-2xl border-2 bg-[#1c120c]/95 animate-popup-banner ${textClass} ${borderClass}`;
    els.specialPopupBox.textContent = text;
    els.specialPopup.classList.remove('hidden');
    els.specialPopup.classList.add('flex');

    els.arena.classList.remove('animate-arena-shake');
    void els.arena.offsetWidth;
    els.arena.classList.add('animate-arena-shake');

    setTimeout(() => {
        els.specialPopup.classList.add('hidden');
        els.specialPopup.classList.remove('flex');
    }, 1850);
}

/** Desenha os 7 marcadores de progresso de pontos em cada placar */
function renderScorePips() {
    const buildPips = (container, currentScore, activeColorClass) => {
        container.innerHTML = '';
        for (let i = 1; i <= state.maxScore; i++) {
            const dot = document.createElement('span');
            dot.className = `w-1.5 h-3 sm:w-2 sm:h-3.5 rounded-full transition-all duration-300 ${
                i <= currentScore ? activeColorClass : 'bg-black/40 border border-amber-200/15'
            }`;
            container.appendChild(dot);
        }
    };

    buildPips(els.pips1, state.score1, 'bg-red-500 shadow-[0_0_6px_#ef4444]');
    buildPips(els.pips2, state.score2, 'bg-sky-500 shadow-[0_0_6px_#0ea5e9]');
}

/** Sincroniza placares, posição do anel na corda e destaque do líder */
function updateUI(msg) {
    els.message.textContent = msg;
    els.score1.textContent = state.score1;
    els.score2.textContent = state.score2;
    els.diceCount1.textContent = `${state.diceCount} ${state.diceCount === 1 ? 'dado' : 'dados'}`;
    els.diceCount2.textContent = `${state.diceCount} ${state.diceCount === 1 ? 'dado' : 'dados'}`;

    renderScorePips();

    const p1Leads = state.score1 > state.score2;
    const p2Leads = state.score2 > state.score1;

    els.p1card.classList.toggle('ring-2', p1Leads);
    els.p1card.classList.toggle('ring-red-500/80', p1Leads);

    els.p2card.classList.toggle('ring-2', p2Leads);
    els.p2card.classList.toggle('ring-sky-500/80', p2Leads);

    // Calcula posição do anel de latão na corda (de 8% a 92%)
    const diff = state.score2 - state.score1;
    const knotPercent = 50 + (diff / state.maxScore) * 42;
    els.ropeKnot.style.left = `${Math.max(8, Math.min(92, knotPercent))}%`;
}

/** Anima o número do placar e cria o indicador flutuante (+1 ou -1) */
function popScore(scoreEl, delta) {
    const isP1 = scoreEl.id === 'score1';
    scoreEl.textContent = isP1 ? state.score1 : state.score2;

    scoreEl.classList.remove('animate-score-pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('animate-score-pop');

    const badge = document.createElement('span');
    badge.className = `absolute -top-2 ${isP1 ? 'left-3' : 'right-3'} font-black text-xl animate-float-up pointer-events-none ${
        delta > 0 ? 'text-emerald-300' : 'text-red-400'
    }`;
    badge.textContent = delta > 0 ? `+${delta}` : `${delta}`;

    const parent = scoreEl.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    parent.appendChild(badge);
    setTimeout(() => badge.remove(), 950);
}

/** Adiciona uma linha ao histórico da partida */
function addLog(text, type = '') {
    if (state.round === 1) els.log.innerHTML = '';

    const entry = document.createElement('div');
    entry.className = 'py-1 px-1.5 rounded border-b border-amber-200/10 ' + (
        type === 'special' ? 'text-amber-300 font-semibold bg-amber-500/10' :
        type === 'loss'    ? 'text-red-300 font-semibold bg-red-500/10' : ''
    );
    entry.textContent = text;
    els.log.prepend(entry);
}

/** Verifica se algum jogador atingiu os 7 pontos */
function checkWinner() {
    if (state.score1 >= state.maxScore) {
        endGame('🔴 Jogador 1 Venceu!', 'text-red-400');
    } else if (state.score2 >= state.maxScore) {
        endGame('🔵 Jogador 2 Venceu!', 'text-sky-400');
    }
}

/** Finaliza a partida e exibe o modal de vitória */
function endGame(title, colorClass) {
    state.gameOver = true;
    els.rollBtn.classList.add('hidden');
    els.restartBtn.classList.remove('hidden');
    sfx.win();

    els.winnerText.textContent = title;
    els.winnerText.className = `font-classic text-3xl sm:text-5xl font-black animate-confetti-pop drop-shadow ${colorClass}`;
    els.winnerSub.textContent = `Placar final: ${state.score1} × ${state.score2} em ${state.round} rodadas`;

    setTimeout(() => {
        els.overlay.classList.remove('hidden');
        els.overlay.classList.add('flex');
    }, 450);
}

/** Reinicia todos os estados para uma nova partida sem recarregar a página */
function resetGame() {
    state.score1 = 0;
    state.score2 = 0;
    state.diceCount = 1;
    state.round = 0;
    state.gameOver = false;
    state.rolling = false;

    els.overlay.classList.add('hidden');
    els.overlay.classList.remove('flex');
    els.restartBtn.classList.add('hidden');
    els.rollBtn.classList.remove('hidden');
    els.rollBtn.disabled = false;

    els.total1.classList.add('opacity-0');
    els.total2.classList.add('opacity-0');
    els.roundCounter.textContent = 'Rodada 0';
    els.log.innerHTML = '<div class="text-amber-200/40 italic px-1">Aguardando o primeiro lance...</div>';

    els.dice1.classList.remove('dice-crowded');
    els.dice2.classList.remove('dice-crowded');
    els.dice1.innerHTML = '';
    els.dice2.innerHTML = '';
    els.dice1.appendChild(makeDie(1, 1));
    els.dice2.appendChild(makeDie(1, 2));

    updateUI('Lance os dados sobre a mesa para começar!');
}


/* ==========================================================================
   6. EVENTOS E INICIALIZAÇÃO
   ========================================================================== */
els.rollBtn.addEventListener('click', rollDice);
els.restartBtn.addEventListener('click', resetGame);
document.getElementById('overlayRestartBtn').addEventListener('click', resetGame);

els.soundToggle.addEventListener('click', () => {
    const isSoundOn = sfx.toggle();
    els.soundToggle.textContent = isSoundOn ? '🔊' : '🔇';
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !state.gameOver && !state.rolling) {
        e.preventDefault();
        rollDice();
    }
});

// Inicia a mesa
resetGame();