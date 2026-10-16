# 🎬 MoviePicker

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

### Connect to TMDB for all movies

Without configuration the app uses a built-in list of ~140 well-known films (`src/movies.js`).
Connect it to [The Movie Database (TMDB)](https://www.themoviedb.org/) to use **its entire catalogue
(about a million movies, with posters)** for both the "All movies" list and the recommendations:

1. Create a free account at themoviedb.org and get a key under **Settings → API**
   (either the *API Key* or the *API Read Access Token* works).
2. Copy `.env.example` to `.env` and paste the key:
   ```bash
   cp .env.example .env
   # edit .env → TMDB_API_KEY=your_key
   ```
   (or run `TMDB_API_KEY=your_key npm start`)
3. `npm start`. The console prints `Connected to TMDB…`, and the "All movies" page shows a
   **TMDB · full catalogue** badge, a "Most popular" sort and **Load more** paging.

With TMDB, "All movies" lets you search any title, filter by genre, and sort by popularity, rating, release date or title.
Each title links to its TMDB page. If TMDB is unreachable, the app falls back to the built-in list automatically.
Note: TMDB has no Sport or Biography genre, so those filters only exist in the built-in list.

## Put it online (Render, free)

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New → Web Service**, then pick this repository and branch.
3. Language **Node**, build command `npm install`, start command `npm start`, instance type **Free**.
4. Under **Environment Variables**, add `TMDB_API_KEY` with your key.
5. Click **Deploy**. You get a URL like `https://moviepicker.onrender.com`.

Alternatively, use **New → Blueprint**: `render.yaml` already describes the service, and Render asks for the key.
On the free plan the app sleeps after ~15 minutes without visitors, so the first visit after that takes 30–60 seconds.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/recommend` | Body: `{ "emotion": "sad" }` **or** `{ "text": "I feel lonely" }`, plus optional `"mode": "lift" \| "match"` and `"exclude": [ids]`. Returns 3 movies. |
| `GET` | `/api/recommend?emotion=sad&mode=match` | Same as above, using query params (`text`, `exclude=1,2,3` also supported). |
| `GET` | `/api/emotions` | All emotions with their genre mappings. |
| `GET` | `/api/movies?q=&genre=&sort=popularity\|rating\|year\|title&page=1` | List and search movies (TMDB: the whole catalogue, 20 per page). |
| `GET` | `/api/movies/:id` | A single movie. |
| `GET` | `/api/genres` | All genres. |
| `GET` | `/api/config` | `{ "source": "tmdb" \| "local" }` |
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
src/tmdb.js          TMDB client (browse, search, recommend)
public/              Web frontend (HTML/CSS/JS, no build step)
test/                node:test unit and API tests
```

To change which genres an emotion maps to, or to add emotions and keywords, edit `src/emotions.js`.
