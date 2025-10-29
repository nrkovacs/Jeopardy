For more info, view the documentation [here](http://cluebase.lukelav.in)

## Static Jeopardy practice board

A standalone Jeopardy! practice board lives in [`webapp/index.html`](webapp/index.html). It uses a subset of the clue data exported from the Cluebase PostgreSQL dump and can be opened directly in a browser—no backend or container setup required.

1. Run `python scripts/export_boards.py` if you want to regenerate the TSV exports from the SQL dump.
2. Open `webapp/index.html` in any modern browser.
3. Pick one of the Kids Week or Teen Tournament boards and play through the rounds.
