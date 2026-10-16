# 🎬 MoviePicker

Tell it how you feel and get **3 movies** to watch right now.

- **Pick one or more emotions** (up to 3, e.g. Sad + Romantic) or **write it in your own words**
  ("stressed after a long day at work", "tired but kind of lonely"). The text is analysed for emotion keywords, with simple negation handling.
  With several emotions, movies that fit all of them rank highest, and each emotion is represented in the 3 picks.
- Every recommendation is rated **6.0 or higher**, and **one of the 3 is a recent release** (marked 🆕 Newest):
  with TMDB, a fitting movie released in the last 12 months; with the built-in list, its most recent fitting film.
- Choose **Change my mood** (e.g. sad → comedies) or **Match my mood** (e.g. sad → dramas).
- Tap **🎬 Find movies** and the picks are revealed **one by one**: a shuffling-cards animation, then each
  movie flips over with its poster as a blurred backdrop (sparkles for the 🆕 newest pick). Move with
  Next/Back, a swipe, or the arrow keys; after the third, see all 3 side by side.
- Hit **🔀 Show me 3 others** for new picks without repeats.
- **▶ Trailer** on every movie plays its official YouTube trailer (via TMDB) in a pop-up.
- **♡ Favourites**: save movies to a watchlist (stored in your browser, on that device).
- **AI mood detection** (optional): with an Anthropic API key, Claude understands any description
  ("my boss yelled at me and I just want to hide under a blanket"), slang, emoji and other languages.
- Browse **All movies**: search by title, director or year; filter by genre; sort by rating or year.

## Run it

Requires Node.js 18+.

```bash
npm install
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

### AI mood detection (optional)

Without configuration, typed feelings are matched against keyword lists in `src/emotions.js`.
For much better understanding, add an [Anthropic API key](https://console.anthropic.com/settings/keys):

```bash
ANTHROPIC_API_KEY=sk-ant-...      # in .env or Render's Environment settings
ANTHROPIC_MODEL=claude-opus-5-5   # optional, this is the default
```

Each typed mood is one small request to Claude (constrained to the app's list of emotions; well under a cent).
If the call fails, the app falls back to keyword matching. Choosing an emotion button never calls the API.

## Put it online (Render, free)

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New → Web Service**, then pick this repository and branch.
3. Language **Node**, build command `npm install`, start command `npm start`, instance type **Free**.
4. Under **Environment Variables**, add `TMDB_API_KEY` with your key (and optionally `ANTHROPIC_API_KEY`).
5. Click **Deploy**. You get a URL like `https://moviepicker.onrender.com`.

Alternatively, use **New → Blueprint**: `render.yaml` already describes the service, and Render asks for the key.
On the free plan the app sleeps after ~15 minutes without visitors, so the first visit after that takes 30–60 seconds.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/recommend` | Body: `{ "emotions": ["sad", "loved"] }` (1–3 emotions) and/or `{ "text": "I feel lonely" }`, plus optional `"mode": "lift" \| "match"` and `"exclude": [ids]`. Returns 3 movies. `"emotion": "sad"` still works. |
| `GET` | `/api/recommend?emotions=sad,loved&mode=match` | Same as above, using query params (`text`, `exclude=1,2,3` also supported). |
| `GET` | `/api/emotions` | All emotions with their genre mappings. |
| `GET` | `/api/movies?q=&genre=&sort=popularity\|rating\|year\|title&page=1` | List and search movies (TMDB: the whole catalogue, 20 per page). |
| `GET` | `/api/movies/:id` | A single movie. |
| `GET` | `/api/genres` | All genres. |
| `GET` | `/api/trailer?id=&title=&year=` | YouTube trailer key for a movie (TMDB id, or title + year), plus a YouTube search link. |
| `GET` | `/api/config` | `{ "source": "tmdb" \| "local", "aiMood": true \| false }` |
| `POST` | `/api/detect` | Body `{ "text": "..." }`: shows which emotion the text maps to. |

Example:

```bash
curl -s localhost:3000/api/recommend -H 'Content-Type: application/json' \
  -d '{"text":"so stressed after work"}'
```

```json
{
  "emotions": [{ "key": "stressed", "label": "Stressed", "emoji": "😰" }],
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
src/recommender.js   Resolves emotions (buttons, text, AI) and builds the recommendation
src/picker.js        Picks 3 movies (weighted random, covers every emotion, genre variety, no repeats)
src/tmdb.js          TMDB client (browse, search, recommend, trailers)
src/ai-mood.js       Optional AI mood detection with Claude
public/              Web frontend (HTML/CSS/JS, no build step)
test/                node:test unit and API tests
```

To change which genres an emotion maps to, or to add emotions and keywords, edit `src/emotions.js`.
