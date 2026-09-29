# Design research and direction

The Mobbin MCP was used to search three areas: daily health routines, exercise prescription lists, and symptom trends. The returned screen previews were inspected before choosing the direction.

| Reference                                                                                               | Observed pattern                                                       | What Rehab takes from it                                             |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Noom — Today](https://mobbin.com/screens/2f73f337-2536-4c95-9bb5-ccbbe6b865cc)                         | Date strip, a prominent daily plan heading, quiet completed task cards | A week strip and an immediately readable list of scheduled sessions  |
| [Bevel — Journal](https://mobbin.com/screens/a89c2740-79d0-4ebd-97d4-0449e1b54494)                      | Compact week navigation above grouped health records                   | A consistent calendar context and low-friction recording             |
| [Hevy — Workout detail](https://mobbin.com/screens/5044347a-4e5a-46b4-b10b-31af46a48770)                | Exercise names followed by clearly separated set and rep information   | Readable prescriptions and a whole-session overview                  |
| [Peloton Strength+ — Workout overview](https://mobbin.com/screens/6d6f1c82-c933-4b90-938b-d562153962b9) | Grouped exercise rows with duration and count metadata                 | A scan-friendly list, with instruction details available when wanted |
| [Visible — Symptom trends](https://mobbin.com/screens/9e9b808a-623e-4296-b98d-7292baab784b)             | Restrained symptom plots and explanatory copy                          | Simple labelled symptom charts; no invented data on missing days     |

## Visual direction (v2)

The first pass used serif greetings, botanical artwork and reassurance copy. It read as a wellness app rather than a training tool. The current UI follows exercise-prescription apps such as Runna: the plan and the dose are the loudest things on screen.

- **Palette.** Near-black ink on a warm grey canvas with white cards. Electric blue marks selection and data. A volt green is reserved for the primary action on dark surfaces. Status colours (green done, amber not recorded, red rejected) always ship with an icon or label.
- **Session identity.** Each exercise category has a fixed colour: mobility teal, strength orange, balance violet, cardio pink, anything else blue. The set was checked with the dataviz palette validator for colour-blind separation and contrast. A session takes the colour of its dominant category. Structure bars show one segment per exercise, sized by sets.
- **Type.** System font only, heavy weights with tight tracking for titles and tabular numbers for stats.
- **Copy.** Factual and short. No greetings, slogans or encouragement lines. Empty states say what is missing and nothing else.
- **Today.** Week strip with a completion bar under each day, a programme strip segmented by phase, a dark "up next" card, then compact session and check-in rows.
- **Session.** Duration, exercise and set counts up top. Each exercise leads with its dose (for example "3 × 20 sec hold") with side, rest, load and equipment as chips. Complete and skip live in a sticky footer.
- **Feel.** Cards scale slightly on press, and native builds give selection and success haptics.

The follow-along flow remains intentionally out of scope: there is no player, exercise stepping or timer.

Browser screenshots from automated verification are written to `artifacts/` locally. They are not Mobbin assets and are not included in the repository by default.
