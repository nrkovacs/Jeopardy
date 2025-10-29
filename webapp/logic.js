export const ROUND_NAMES = {
  'J!': 'Jeopardy!',
  'DJ!': 'Double Jeopardy!'
};

export function parseTsv(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const lines = trimmed.split(/\r?\n/);
  const headers = lines.shift().split('\t');
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const fields = line.split('\t');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = fields[index] ?? '';
      });
      return row;
    });
}

export function parseValue(value) {
  if (!value || value === '\\N') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(amount) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  return formatter.format(amount);
}

export function buildBoardData(clues) {
  const rounds = new Map();
  let finalJeopardy = null;

  for (const clue of clues) {
    const roundId = clue.round;
    if (roundId === 'FJ!') {
      finalJeopardy = {
        category: clue.category,
        text: clue.clue,
        response: clue.response
      };
      continue;
    }

    if (!ROUND_NAMES[roundId]) {
      continue;
    }

    if (!rounds.has(roundId)) {
      rounds.set(roundId, {
        id: roundId,
        name: ROUND_NAMES[roundId],
        categories: new Map()
      });
    }

    const round = rounds.get(roundId);

    if (!round.categories.has(clue.category)) {
      round.categories.set(clue.category, {
        title: clue.category,
        order: round.categories.size,
        clues: []
      });
    }

    const value = parseValue(clue.value);
    round.categories.get(clue.category).clues.push({
      id: clue.id,
      value,
      displayValue: value ? formatCurrency(value) : '',
      rawValue: clue.value,
      dailyDouble: clue.daily_double === 't',
      text: clue.clue,
      response: clue.response
    });
  }

  const orderedRounds = Array.from(rounds.values()).sort((a, b) => {
    if (a.id === 'J!') {
      return -1;
    }
    if (b.id === 'J!') {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });

  for (const round of orderedRounds) {
    round.categories = Array.from(round.categories.values())
      .sort((a, b) => a.order - b.order)
      .map((category) => {
        category.clues.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
        return category;
      });
  }

  return {
    rounds: orderedRounds,
    finalJeopardy
  };
}

export function createGameSession(boardData) {
  const remainingClues = boardData.rounds.map((round) =>
    round.categories.reduce((count, category) => count + category.clues.length, 0)
  );

  return {
    boardData,
    currentRoundIndex: 0,
    score: 0,
    usedClues: new Set(),
    remainingClues,
    finalUnlocked: boardData.rounds.length === 0,
    finalRevealed: false
  };
}

function normalizeWager(clue, wager) {
  if (!clue.dailyDouble) {
    return clue.value ?? 0;
  }
  if (!Number.isFinite(wager)) {
    return clue.value ?? 0;
  }
  const normalized = Math.floor(wager);
  return normalized > 0 ? normalized : clue.value ?? 0;
}

export function resolveClue(session, { roundIndex, clueKey, clue, correct, wager }) {
  if (!session || !clueKey) {
    return {
      amount: 0,
      score: session?.score ?? 0,
      roundAdvanced: false,
      finalUnlocked: session?.finalUnlocked ?? false
    };
  }

  const amount = normalizeWager(clue, wager);
  session.score += correct ? amount : -amount;
  session.usedClues.add(clueKey);
  if (session.remainingClues[roundIndex] > 0) {
    session.remainingClues[roundIndex] -= 1;
  }

  let roundAdvanced = false;
  if (session.remainingClues[roundIndex] === 0) {
    if (roundIndex < session.boardData.rounds.length - 1) {
      session.currentRoundIndex = roundIndex + 1;
      roundAdvanced = true;
    } else {
      session.currentRoundIndex = session.boardData.rounds.length;
      session.finalUnlocked = true;
    }
  }

  return {
    amount,
    score: session.score,
    roundAdvanced,
    finalUnlocked: session.finalUnlocked
  };
}
