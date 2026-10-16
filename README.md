# 🎬 MoodFlix

Tell it how you feel and get **3 movies** to watch right now.

- **Pick an emotion** (Happy, Sad, Stressed, Lonely, Bored, …) or **write it in your own words**
  ("stressed after a long day at work", "not happy today"). The text is analysed for emotion keywords, with simple negation handling.
- Choose **Change my mood** (e.g. sad → comedies) or **Match my mood** (e.g. sad → dramas).
- Hit **🔀 Show me 3 others** for new picks without repeats.
- Browse **All movies**: search by title, director or year; filter by genre; sort by rating or year.

## Run it

Requires Node.js 18+. There are no dependencies to install.

```bash
npm start          # http://localhost:3000
npm test
```

### Use the full TMDB catalogue (optional)

By default it uses the built-in catalogue of ~140 well-known films (`src/movies.js`).
For recommendations from all movies on [The Movie Database](https://www.themoviedb.org/settings/api), set a free API key:

```bash
TMDB_API_KEY=your_key npm start
```

If TMDB is unreachable, it falls back to the built-in catalogue automatically.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/recommend` | Body: `{ "emotion": "sad" }` **or** `{ "text": "I feel lonely" }`, plus optional `"mode": "lift" \| "match"` and `"exclude": [ids]`. Returns 3 movies. |
| `GET` | `/api/recommend?emotion=sad&mode=match` | Same as above, using query params (`text`, `exclude=1,2,3` also supported). |
| `GET` | `/api/emotions` | All emotions with their genre mappings. |
| `GET` | `/api/movies?q=&genre=&sort=title\|rating\|year` | List and search the catalogue. |
| `GET` | `/api/movies/:id` | A single movie. |
| `GET` | `/api/genres` | All genres. |
| `POST` | `/api/detect` | Body `{ "text": "..." }`: shows which emotion the text maps to. |

Example:

```bash
curl -s localhost:3000/api/recommend -H 'Content-Type: application/json' \
  -d '{"text":"so stressed after work"}'
```

```json
{
  "emotion": { "key": "stressed", "label": "Stressed", "emoji": "😰" },
  "detectedFrom": "text",
  "mode": "lift",
  "genres": ["Animation", "Comedy", "Family", "Documentary"],
  "message": "Easy, comforting watches to help you unwind.",
  "source": "local",
  "movies": [ { "id": 107, "title": "Up", "year": 2009, "genres": ["Animation", "Adventure", "Family"], "...": "..." } ]
}
```

## Project structure

```
server.js            HTTP server, REST API and static file serving
src/movies.js        Built-in movie catalogue
src/emotions.js      Emotions → genres mapping and free-text emotion detection
src/recommender.js   Picks 3 movies (weighted random, genre variety, no repeats)
src/tmdb.js          Optional TMDB integration
public/              Web frontend (HTML/CSS/JS, no build step)
test/                node:test unit and API tests
```

To change which genres an emotion maps to, or to add emotions and keywords, edit `src/emotions.js`.
