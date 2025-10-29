import {
  buildBoardData,
  createGameSession,
  formatCurrency,
  parseTsv,
  resolveClue as resolveClueState
} from './logic.js';

const gameSelect = document.querySelector('#gameSelect');
const resetButton = document.querySelector('#resetButton');
const boardContainer = document.querySelector('#boardContainer');
const scoreValue = document.querySelector('#scoreValue');
const roundLabel = document.querySelector('#roundLabel');
const gameNotes = document.querySelector('#gameNotes');
const finalSection = document.querySelector('#finalJeopardy');

const modal = document.querySelector('#clueModal');
const modalRound = document.querySelector('#modalRound');
const modalCategory = document.querySelector('#clueCategory');
const modalValue = document.querySelector('#clueValue');
const modalText = document.querySelector('#clueText');
const modalResponse = document.querySelector('#clueResponse');
const responseSection = document.querySelector('#responseSection');
const dailyDoubleNotice = document.querySelector('#dailyDouble');
const wagerControls = document.querySelector('#wagerControls');
const wagerInput = document.querySelector('#wagerInput');
const showResponseButton = document.querySelector('#showResponseButton');
const correctButton = document.querySelector('#correctButton');
const incorrectButton = document.querySelector('#incorrectButton');
const closeButton = document.querySelector('#closeButton');

const boardTemplate = document.querySelector('#boardTemplate');
const categoryTemplate = document.querySelector('#categoryTemplate');
const clueTemplate = document.querySelector('#clueTemplate');

const state = {
  games: [],
  currentGameId: null,
  boardData: null,
  session: null,
  clueLookup: new Map(),
  activeClue: null
};

async function init() {
  const games = await loadGames();
  state.games = games;
  populateGameSelect(games);
  const defaultGame = games.find((game) => game.default) ?? games[0];
  if (defaultGame) {
    await loadGame(defaultGame.game_id);
  }

  gameSelect.addEventListener('change', async (event) => {
    const gameId = event.target.value;
    if (gameId) {
      await loadGame(gameId);
    }
  });

  resetButton.addEventListener('click', async () => {
    if (state.currentGameId) {
      await loadGame(state.currentGameId);
    }
  });

  showResponseButton.addEventListener('click', () => {
    responseSection.hidden = false;
  });

  correctButton.addEventListener('click', () => resolveClue(true));
  incorrectButton.addEventListener('click', () => resolveClue(false));
  closeButton.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

function populateGameSelect(games) {
  gameSelect.innerHTML = '';
  games.forEach((game) => {
    const option = document.createElement('option');
    option.value = game.game_id;
    option.textContent = `${game.label} — ${game.difficulty.toUpperCase()}`;
    if (game.default) {
      option.selected = true;
    }
    gameSelect.appendChild(option);
  });
}

async function loadGames() {
  const response = await fetch('data/games.tsv');
  const text = await response.text();
  const rows = parseTsv(text);
  return rows.map((row) => ({
    game_id: row.game_id,
    label: row.label,
    difficulty: row.difficulty,
    air_date: row.air_date,
    notes: row.notes,
    default: row.default === 'yes'
  }));
}

async function loadGame(gameId) {
  const response = await fetch(`data/clues_${gameId}.tsv`);
  const text = await response.text();
  const rows = parseTsv(text);
  const boardData = buildBoardData(rows);
  const session = createGameSession(boardData);

  state.currentGameId = gameId;
  state.boardData = boardData;
  state.session = session;
  state.clueLookup.clear();
  state.activeClue = null;

  scoreValue.textContent = formatCurrency(state.session.score);
  const selectedGame = state.games.find((g) => g.game_id === gameId);
  if (selectedGame) {
    gameNotes.textContent = `${selectedGame.label} • Difficulty: ${selectedGame.difficulty.toUpperCase()}`;
  } else {
    gameNotes.textContent = '';
  }

  renderBoard();
  updateRoundLabel();
  renderFinalJeopardy();
}

function renderBoard() {
  boardContainer.innerHTML = '';
  state.clueLookup.clear();

  if (!state.boardData || !state.session) {
    return;
  }

  state.boardData.rounds.forEach((round, roundIndex) => {
    const boardFragment = boardTemplate.content.cloneNode(true);
    const header = boardFragment.querySelector('.round-header');
    const grid = boardFragment.querySelector('.grid');

    header.textContent = `${round.name}`;
    if (roundIndex > state.session.currentRoundIndex) {
      header.classList.add('inactive');
    }

    round.categories.forEach((category, categoryIndex) => {
      const categoryNode = categoryTemplate.content.firstElementChild.cloneNode(true);
      categoryNode.textContent = category.title;
      grid.appendChild(categoryNode);
    });

    const maxClues = Math.max(...round.categories.map((cat) => cat.clues.length));

    for (let clueIndex = 0; clueIndex < maxClues; clueIndex += 1) {
      round.categories.forEach((category, categoryIndex) => {
        const clueData = category.clues[clueIndex];
        const button = clueTemplate.content.firstElementChild.cloneNode(true);
        const key = `${roundIndex}-${categoryIndex}-${clueIndex}`;

        if (clueData) {
          const used = state.session.usedClues.has(key);
          button.textContent = used ? '' : clueData.displayValue || 'Clue';
          button.dataset.clueKey = key;
          button.dataset.roundIndex = String(roundIndex);
          button.disabled = used || roundIndex !== state.session.currentRoundIndex;
          if (used) {
            button.classList.add('used');
          } else {
            button.addEventListener('click', onClueClick);
          }
          state.clueLookup.set(key, {
            roundIndex,
            categoryIndex,
            clueIndex,
            button,
            data: clueData
          });
        } else {
          button.disabled = true;
          button.classList.add('used');
          button.textContent = '';
        }

        grid.appendChild(button);
      });
    }

    boardContainer.appendChild(boardFragment);
  });
}

function onClueClick(event) {
  const button = event.currentTarget;
  const key = button.dataset.clueKey;
  const roundIndex = Number(button.dataset.roundIndex);

  if (
    !key ||
    !state.session ||
    state.session.usedClues.has(key) ||
    roundIndex !== state.session.currentRoundIndex
  ) {
    return;
  }

  const clueEntry = state.clueLookup.get(key);
  if (!clueEntry) {
    return;
  }

  const { data } = clueEntry;
  state.activeClue = {
    key,
    roundIndex,
    data,
    button
  };

  modalRound.textContent = state.boardData.rounds[roundIndex].name;
  modalCategory.textContent = categoryTitleForKey(key);
  modalValue.textContent = data.displayValue;
  modalText.textContent = data.text;
  modalResponse.textContent = data.response;

  responseSection.hidden = true;
  dailyDoubleNotice.hidden = !data.dailyDouble;
  wagerControls.hidden = !data.dailyDouble;
  if (data.dailyDouble) {
    const defaultWager = data.value ?? 0;
    wagerInput.value = defaultWager > 0 ? defaultWager : 0;
    wagerInput.focus();
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function categoryTitleForKey(key) {
  const { roundIndex, categoryIndex } = parseKey(key);
  return state.boardData.rounds[roundIndex].categories[categoryIndex].title;
}

function parseKey(key) {
  const [roundIndex, categoryIndex, clueIndex] = key.split('-').map(Number);
  return { roundIndex, categoryIndex, clueIndex };
}

function resolveClue(correct) {
  if (!state.activeClue || !state.session) {
    return;
  }
  const { key, data, button, roundIndex } = state.activeClue;
  const wager = data.dailyDouble ? Number(wagerInput.value) : undefined;

  const result = resolveClueState(state.session, {
    roundIndex,
    clueKey: key,
    clue: data,
    correct,
    wager
  });

  button.classList.add('used');
  button.disabled = true;
  button.textContent = '';

  scoreValue.textContent = formatCurrency(state.session.score);
  closeModal();
  updateRoundLabel();

  if (result.roundAdvanced) {
    enableRound(state.session.currentRoundIndex);
  }

  if (result.finalUnlocked) {
    renderFinalJeopardy();
  }
}

function enableRound(roundIndex) {
  const roundHeaders = boardContainer.querySelectorAll('.round-header');
  if (roundHeaders[roundIndex]) {
    roundHeaders[roundIndex].classList.remove('inactive');
  }
  const buttons = boardContainer.querySelectorAll(`.clue[data-round-index="${roundIndex}"]`);
  buttons.forEach((button) => {
    if (!button.classList.contains('used')) {
      button.disabled = false;
    }
  });
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  state.activeClue = null;
}

function updateRoundLabel() {
  if (!state.boardData || !state.session) {
    roundLabel.textContent = 'Loading…';
    return;
  }

  if (state.session.currentRoundIndex < state.boardData.rounds.length) {
    const round = state.boardData.rounds[state.session.currentRoundIndex];
    const remaining = state.session.remainingClues[state.session.currentRoundIndex];
    roundLabel.textContent = `${round.name} — ${remaining} clue${remaining === 1 ? '' : 's'} remaining`;
  } else if (state.session.finalUnlocked) {
    roundLabel.textContent = 'Final Jeopardy!';
  } else {
    roundLabel.textContent = 'Game complete';
  }
}

function renderFinalJeopardy() {
  finalSection.innerHTML = '';
  if (!state.boardData || !state.session) {
    return;
  }

  const { finalJeopardy } = state.boardData;
  if (!finalJeopardy) {
    const message = document.createElement('p');
    message.textContent = 'This archived game does not include a Final Jeopardy clue in the data set.';
    finalSection.appendChild(message);
    return;
  }

  if (!state.session.finalUnlocked) {
    const lockedMessage = document.createElement('p');
    lockedMessage.textContent = 'Clear both boards to unlock Final Jeopardy!';
    finalSection.appendChild(lockedMessage);
    return;
  }

  const category = document.createElement('h2');
  category.textContent = `Final Jeopardy: ${finalJeopardy.category}`;
  finalSection.appendChild(category);

  const clue = document.createElement('p');
  clue.textContent = state.session.finalRevealed
    ? finalJeopardy.text
    : 'Press “Reveal Final Jeopardy” to see the clue.';
  finalSection.appendChild(clue);

  if (state.session.finalRevealed) {
    const response = document.createElement('p');
    response.innerHTML = `<strong>Response:</strong> ${finalJeopardy.response}`;
    finalSection.appendChild(response);
  }

  if (!state.session.finalRevealed) {
    const revealButton = document.createElement('button');
    revealButton.type = 'button';
    revealButton.textContent = 'Reveal Final Jeopardy';
    revealButton.addEventListener('click', () => {
      state.session.finalRevealed = true;
      renderFinalJeopardy();
    });
    finalSection.appendChild(revealButton);
  }
}

init();
