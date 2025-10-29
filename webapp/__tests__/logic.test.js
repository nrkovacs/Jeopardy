import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoardData,
  createGameSession,
  formatCurrency,
  parseTsv,
  resolveClue
} from '../logic.js';

function createSampleClues() {
  return [
    {
      id: '1',
      game_id: 'test',
      value: '200',
      daily_double: 'f',
      round: 'J!',
      category: 'Alpha',
      clue: 'Alpha 200',
      response: 'A-200'
    },
    {
      id: '2',
      game_id: 'test',
      value: '400',
      daily_double: 'f',
      round: 'J!',
      category: 'Alpha',
      clue: 'Alpha 400',
      response: 'A-400'
    },
    {
      id: '3',
      game_id: 'test',
      value: '200',
      daily_double: 'f',
      round: 'J!',
      category: 'Beta',
      clue: 'Beta 200',
      response: 'B-200'
    },
    {
      id: '4',
      game_id: 'test',
      value: '400',
      daily_double: 'f',
      round: 'J!',
      category: 'Beta',
      clue: 'Beta 400',
      response: 'B-400'
    },
    {
      id: '5',
      game_id: 'test',
      value: '400',
      daily_double: 't',
      round: 'DJ!',
      category: 'Gamma',
      clue: 'Gamma 400',
      response: 'G-400'
    },
    {
      id: '6',
      game_id: 'test',
      value: '800',
      daily_double: 'f',
      round: 'DJ!',
      category: 'Gamma',
      clue: 'Gamma 800',
      response: 'G-800'
    },
    {
      id: '7',
      game_id: 'test',
      value: '400',
      daily_double: 'f',
      round: 'DJ!',
      category: 'Delta',
      clue: 'Delta 400',
      response: 'D-400'
    },
    {
      id: 'FJ',
      game_id: 'test',
      value: '',
      daily_double: 'f',
      round: 'FJ!',
      category: 'Final Category',
      clue: 'Final clue',
      response: 'Final response'
    }
  ];
}

test('parseTsv trims whitespace and splits fields', () => {
  const text = '\tid\tvalue\n\n\t\n1\t200\n2\t400\n';
  const rows = parseTsv(text);
  assert.deepStrictEqual(rows, [
    { id: '1', value: '200' },
    { id: '2', value: '400' }
  ]);
});

test('parseTsv returns an empty array for blank input', () => {
  assert.deepStrictEqual(parseTsv('   \n\n  '), []);
});

test('buildBoardData organizes clues by round and category', () => {
  const boardData = buildBoardData(createSampleClues());
  assert.strictEqual(boardData.rounds.length, 2);
  assert.strictEqual(boardData.rounds[0].name, 'Jeopardy!');
  assert.deepStrictEqual(
    boardData.rounds[0].categories.map((category) => category.title),
    ['Alpha', 'Beta']
  );
  const alphaClues = boardData.rounds[0].categories[0].clues;
  assert.deepStrictEqual(alphaClues.map((clue) => clue.displayValue), ['$200', '$400']);
  assert.deepStrictEqual(boardData.finalJeopardy, {
    category: 'Final Category',
    text: 'Final clue',
    response: 'Final response'
  });
});

test('createGameSession tracks score, rounds, and unlocking Final Jeopardy', () => {
  const boardData = buildBoardData(createSampleClues());
  const session = createGameSession(boardData);

  assert.strictEqual(session.currentRoundIndex, 0);
  assert.deepStrictEqual(session.remainingClues, [4, 3]);
  assert.strictEqual(formatCurrency(session.score), '$0');

  const round0 = boardData.rounds[0];
  const cluesRound0 = [
    { key: '0-0-0', clue: round0.categories[0].clues[0], correct: true },
    { key: '0-0-1', clue: round0.categories[0].clues[1], correct: false },
    { key: '0-1-0', clue: round0.categories[1].clues[0], correct: true },
    { key: '0-1-1', clue: round0.categories[1].clues[1], correct: true }
  ];

  let lastResult = null;
  cluesRound0.forEach((entry) => {
    lastResult = resolveClue(session, {
      roundIndex: 0,
      clueKey: entry.key,
      clue: entry.clue,
      correct: entry.correct,
      wager: undefined
    });
  });

  assert.strictEqual(session.score, 400);
  assert.ok(lastResult?.roundAdvanced);
  assert.strictEqual(session.currentRoundIndex, 1);
  assert.deepStrictEqual(session.remainingClues, [0, 3]);

  const round1 = boardData.rounds[1];
  const djClues = [
    { key: '1-0-0', clue: round1.categories[0].clues[0], correct: true, wager: 1500 },
    { key: '1-0-1', clue: round1.categories[0].clues[1], correct: true },
    { key: '1-1-0', clue: round1.categories[1].clues[0], correct: false }
  ];

  djClues.forEach((entry) => {
    lastResult = resolveClue(session, {
      roundIndex: 1,
      clueKey: entry.key,
      clue: entry.clue,
      correct: entry.correct,
      wager: entry.wager
    });
  });

  assert.strictEqual(session.score, 2300);
  assert.ok(lastResult?.finalUnlocked);
  assert.ok(session.finalUnlocked);
  assert.strictEqual(session.currentRoundIndex, boardData.rounds.length);
  assert.deepStrictEqual(session.remainingClues, [0, 0]);
});

test('Daily Double wagers fall back to the clue value when invalid', () => {
  const boardData = buildBoardData(createSampleClues());
  const session = createGameSession(boardData);
  const dailyDouble = boardData.rounds[1].categories[0].clues[0];

  boardData.rounds[0].categories.forEach((category, categoryIndex) => {
    category.clues.forEach((clue, clueIndex) => {
      resolveClue(session, {
        roundIndex: 0,
        clueKey: `0-${categoryIndex}-${clueIndex}`,
        clue,
        correct: true,
        wager: undefined
      });
    });
  });

  const result = resolveClue(session, {
    roundIndex: 1,
    clueKey: '1-0-0',
    clue: dailyDouble,
    correct: false,
    wager: -500
  });

  assert.strictEqual(result.amount, dailyDouble.value);
  assert.strictEqual(session.score, 1200 - dailyDouble.value);
});
