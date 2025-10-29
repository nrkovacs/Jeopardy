For more info, view the documentation [here](http://cluebase.lukelav.in)

## Project structure

The repository contains a self-contained static web experience that can be opened directly in a browser, along with helper scripts and automated tests:

- `webapp/` – Client-side implementation of the Jeopardy! practice board.
  - `index.html` – Entry point that loads the board UI.
  - `styles.css` – Presentation layer for the board.
  - `app.js` – Browser controller responsible for rendering categories, handling user input, and wiring up the shared logic utilities.
  - `logic.js` – Reusable helpers for parsing TSV clue data, constructing boards, tracking session state, and calculating scores.
  - `data/` – TSV snapshots of selected Kids Week and Teen Tournament games that are loaded by default.
  - `__tests__/` – Node-based tests that exercise board parsing and scoring logic.
- `scripts/export_boards.py` – Utility script for rebuilding the TSV snapshots from the Cluebase SQL dump.

## Running and using the game

1. Open `webapp/index.html` in any modern browser. The page loads without a server or build step.
2. Choose a board from the dropdown. By default the list is limited to easier Kids Week and Teen Tournament boards.
3. Select a clue to reveal its text, mark it correct or incorrect, and continue through the round. Daily Doubles prompt for a wager before revealing the clue, and Final Jeopardy unlocks automatically after the Double Jeopardy round is completed.

## Regenerating clue data

Run the export script to refresh the TSV snapshots when the upstream SQL dump changes:

```
python scripts/export_boards.py
```

This requires the Cluebase PostgreSQL dump to be available locally.

## Automated tests

Install dependencies once with `npm install`, then run the suite whenever changes are made:

```
npm test
```
