# presentation/

Everything for presenting Tennis101 in an interview.

| File | What it is | Open online |
|---|---|---|
| `index.html` | The slide deck: how the project was figured out, step by step (12 slides, arrow keys) | https://ryanli0819.github.io/Tennis101/presentation/ |
| `sql-explorer.html` | Runs the project's SQL queries live in the browser | https://ryanli0819.github.io/Tennis101/presentation/sql-explorer.html |
| `TALKING_POINTS.md` | 30-second pitch, timeline, notes per slide, likely questions, demo checklist | — |
| `CODE_TOUR.md` | The codebase with labelled annotations (A1, B2, …) to point at while explaining | — |

Related live pages: [the game](https://ryanli0819.github.io/Tennis101/), [the Agent Control Room](https://ryanli0819.github.io/Tennis101/agents/dashboard.html), [the serve viewer](https://ryanli0819.github.io/Tennis101/datasets/serves/viewer.html).

The deck's charts and skeletons read the project's own data files, so they update as the data improves. After changing data, rebuild the database with `python3 -I data/build_db.py` and `python3 -I data/run_queries.py`.
