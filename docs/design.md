# Design research and direction

The Mobbin MCP was used to search three areas: daily health routines, exercise prescription lists, and symptom trends. The returned screen previews were inspected before choosing the direction.

| Reference                                                                                               | Observed pattern                                                       | What Rehab takes from it                                             |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Noom — Today](https://mobbin.com/screens/2f73f337-2536-4c95-9bb5-ccbbe6b865cc)                         | Date strip, a prominent daily plan heading, quiet completed task cards | A week strip and an immediately readable list of scheduled sessions  |
| [Bevel — Journal](https://mobbin.com/screens/a89c2740-79d0-4ebd-97d4-0449e1b54494)                      | Compact week navigation above grouped health records                   | A consistent calendar context and low-friction recording             |
| [Hevy — Workout detail](https://mobbin.com/screens/5044347a-4e5a-46b4-b10b-31af46a48770)                | Exercise names followed by clearly separated set and rep information   | Readable prescriptions and a whole-session overview                  |
| [Peloton Strength+ — Workout overview](https://mobbin.com/screens/6d6f1c82-c933-4b90-938b-d562153962b9) | Grouped exercise rows with duration and count metadata                 | A scan-friendly list, with instruction details available when wanted |
| [Visible — Symptom trends](https://mobbin.com/screens/9e9b808a-623e-4296-b98d-7292baab784b)             | Restrained symptom plots and explanatory copy                          | Simple labelled symptom charts; no invented data on missing days     |

The final design is original: warm ivory, forest green, muted sage, serif headlines and system-font controls. A lightweight botanical SVG gives the programme card a sense of growth without exercise photography or clinical branding. The matching app icon is derived from the same vector artwork.

The product prioritises the daily plan, a complete exercise reference, and easy completion. It uses four bottom tabs. Completion is encouragement, not a points system. Progress distinguishes due sessions from upcoming ones and shows the latest recorded symptom values without interpreting them as treatment recommendations.

The follow-along flow was intentionally removed from the implementation: there is no player, exercise stepping or timer. Exercise instructions expand inside the list. The user decides how to execute the plan.

Browser screenshots from automated verification are written to `artifacts/` locally. They are not Mobbin assets and are not included in the repository by default.
