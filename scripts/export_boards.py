"""Export selected Jeopardy boards to TSV files for the static web app."""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

SQL_DUMP_PATH = Path("postgres/init/jeopardy201908021145.sql")
DATA_DIR = Path("webapp/data")

# Selected game IDs mapped to descriptive metadata
SELECTED_GAMES: Dict[str, Dict[str, str]] = {
    # Kids Week games
    "1620": {
        "label": "2012 Kids Week Game 1 (July 30, 2012)",
        "difficulty": "kids",
        "notes": "2012 Kids Week game 1.",
        "air_date": "2012-07-30",
    },
    "2315": {
        "label": "2009 Kids Week Game 1 (July 13, 2009)",
        "difficulty": "kids",
        "notes": "2009 Kids Week game 1.",
        "air_date": "2009-07-13",
    },
    # Teen Tournament semifinal with full board
    "185": {
        "label": "2018 Teen Tournament Semifinal Game 3 (Nov 16, 2018)",
        "difficulty": "teen",
        "notes": "2018 Teen Tournament semifinal game 3.",
        "air_date": "2018-11-16",
    },
}


@dataclass
class GameMetadata:
    game_id: str
    air_date: str
    notes: str
    label: str
    difficulty: str


@dataclass
class Clue:
    id: str
    game_id: str
    value: str
    daily_double: str
    round: str
    category: str
    clue: str
    response: str


def parse_games(game_ids: Iterable[str]) -> Dict[str, GameMetadata]:
    remaining = set(game_ids)
    results: Dict[str, GameMetadata] = {}
    with SQL_DUMP_PATH.open("r", encoding="utf-8") as handle:
        in_games = False
        for raw_line in handle:
            if not in_games:
                if raw_line.startswith("COPY public.games "):
                    in_games = True
                continue
            line = raw_line.rstrip("\n")
            if line == "\\.":
                break
            parts = line.split("\t")
            if len(parts) < 12:
                continue
            game_id, episode_num, season_id, air_date, notes = parts[:5]
            if game_id in remaining:
                meta = SELECTED_GAMES[game_id]
                results[game_id] = GameMetadata(
                    game_id=game_id,
                    air_date=air_date,
                    notes=notes,
                    label=meta["label"],
                    difficulty=meta["difficulty"],
                )
                remaining.remove(game_id)
                if not remaining:
                    break
    missing = remaining - set(results)
    if missing:
        raise RuntimeError(f"Missing metadata for game IDs: {sorted(missing)}")
    return results


def parse_clues(game_ids: Iterable[str]) -> Dict[str, List[Clue]]:
    targets = set(game_ids)
    collected: Dict[str, List[Clue]] = {gid: [] for gid in targets}
    with SQL_DUMP_PATH.open("r", encoding="utf-8") as handle:
        in_clues = False
        for raw_line in handle:
            if not in_clues:
                if raw_line.startswith("COPY public.clues "):
                    in_clues = True
                continue
            line = raw_line.rstrip("\n")
            if line == "\\.":
                break
            parts = line.split("\t")
            if len(parts) < 8:
                continue
            clue = Clue(*parts[:8])
            if clue.game_id in targets:
                collected[clue.game_id].append(clue)
    return collected


def write_games_metadata(metadata: Dict[str, GameMetadata], order: List[str]) -> None:
    output_path = DATA_DIR / "games.tsv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(["game_id", "label", "difficulty", "air_date", "notes", "default"])
        first = True
        for game_id in order:
            meta = metadata[game_id]
            writer.writerow([
                game_id,
                meta.label,
                meta.difficulty,
                meta.air_date,
                meta.notes,
                "yes" if first else "no",
            ])
            first = False


def write_clues(clues: Dict[str, List[Clue]]) -> None:
    for game_id, entries in clues.items():
        output_path = DATA_DIR / f"clues_{game_id}.tsv"
        with output_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, delimiter="\t")
            writer.writerow(["id", "game_id", "value", "daily_double", "round", "category", "clue", "response"])
            for clue in entries:
                writer.writerow([
                    clue.id,
                    clue.game_id,
                    clue.value,
                    clue.daily_double,
                    clue.round,
                    clue.category,
                    clue.clue,
                    clue.response,
                ])


def main() -> None:
    game_ids = list(SELECTED_GAMES)
    metadata = parse_games(game_ids)
    clues = parse_clues(game_ids)
    write_games_metadata(metadata, game_ids)
    write_clues(clues)
    print(f"Exported {len(game_ids)} games to {DATA_DIR}")


if __name__ == "__main__":
    main()
