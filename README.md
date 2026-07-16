# PlotPoint 🎬

A RAG-based semantic movie discovery engine that transforms natural language queries into 3072-dimensional Gemini embeddings, executing pgvector cosine similarity search across a hybrid vector-relational 16-table PostgreSQL schema — fully containerized with Docker.

---

## What Makes It Different

Most movie apps search by title or genre. PlotPoint searches by **feeling**.

Type *"ek aisi movie jo dil ko chhu jaye aur akhir mein rula de"* in Roman Urdu and get Dilwale Dulhania Le Jayenge as a top result — against a fully English database. No language detection. No manual tagging. Pure semantic understanding across languages.

---

## Features

- **Semantic Search** — natural language queries converted to vectors, matched by meaning not keywords
- **Multilingual Support** — Roman Urdu queries return accurate English results out of the box
- **RAG Pipeline** — retrieved results fed to Gemini to generate contextual explanations for every match
- **Content-Based Recommendations** — user taste vector calculated by averaging liked movie embeddings
- **Hybrid Search** — cosine similarity ranking combined with SQL filters (genre, year, rating)
- **Full CRUD** — reviews, ratings, favorites, watchlist
- **Analytics Dashboard** — genre popularity, top rated movies, search activity charts
- **Rating Comparison** — IMDb global score vs platform user ratings side by side

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL + pgvector extension |
| Vector Search | ivfflat index, cosine similarity, 3072-dim embeddings |
| AI Layer | Gemini API (embeddings + RAG generation) |
| Data Source | TMDB API (250 curated films) |
| Backend | Node.js + Express REST API |
| Frontend | HTML, CSS, JavaScript (no framework) |
| Infrastructure | Docker |

---

### Database Schema

A highly normalized 16-table relational schema engineered with strict referential integrity, junction tables, composite keys, and cascade constraints:

*   **movies** ➔ Core movie data + 3072-dim vector embedding column
*   **genres** ➔ Unique catalog of movie genres
*   **movie_genres** ➔ M:M junction table (`movies` ↔ `genres`)
*   **cast_members** ➔ Detailed repository of actors and directors
*   **movie_cast** ➔ M:M junction table (`movies` ↔ `cast_members`)
*   **users** ➔ Core platform user authentication & profile data
*   **user_favorites** ➔ M:M junction table (`users` ↔ `movies`)
*   **watchlist** ➔ User-curated watchlists tracking active consumption status
*   **reviews** ➔ User-written critiques with full CRUD execution state
*   **ratings** ➔ Platform-specific 1-5 star metrics (isolated from IMDb)
*   **languages** ➔ System language definitions
*   **movie_languages** ➔ M:M junction table (`movies` ↔ `languages`)
*   **production_countries** ➔ Global production locations
*   **movie_countries** ➔ M:M junction table (`movies` ↔ `production_countries`)
*   **search_logs** ➔ Historical auditing tracking every inbound user query
*   **fetch_logs** ➔ Execution telemetry tracking ETL data pipeline performance

---

## How Semantic Search Works

User types query (any language)
* → Gemini converts query to 3072-dimensional vector
* → pgvector compares against all 250 stored movie vectors
* → Cosine similarity ranks results by semantic closeness
* → Top result fed back to Gemini (RAG)
* → Gemini generates explanation of why it matched
* → Results + explanation returned to frontend

Movie vectors are generated from combined text:
title + genres + description → 3072-dim embedding

---

## API Routes

* GET  /api/movies              → top rated movies with genres
* GET  /api/movies/:id          → single movie with cast
* GET  /api/search?prompt=...   → semantic search + RAG explanation
* GET  /api/users               → all users
* POST /api/favorites/toggle    → add or remove favorite
* GET  /api/favorites/:user_id  → user favorites
* POST /api/watchlist           → add to watchlist
* GET  /api/watchlist/:user_id  → user watchlist
* DELETE /api/watchlist         → remove from watchlist
* PATCH /api/watchlist/watched  → mark as watched
* POST /api/reviews             → create review
* GET  /api/reviews/:movie_id   → movie reviews
* PUT  /api/reviews/:review_id  → edit review
* DELETE /api/reviews/:review_id → delete review
* POST /api/ratings             → rate a movie
* GET  /api/ratings/:movie_id   → average rating + count
* GET  /api/dashboard           → analytics data
* POST /api/search-log          → log search query

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed and running
- TMDB API key → [themoviedb.org](https://www.themoviedb.org/settings/api)
- Gemini API key → [aistudio.google.com](https://aistudio.google.com)

---

### Environment Setup

Create a `.env` file inside the `Backend/` folder:

```env
TMDB_API=your_tmdb_api_key_here
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

---

### Running with Docker (Recommended)

The entire application runs via Docker Compose — three containers managed together:

| Container | Description | Port |
|---|---|---|
| `plot-point-plotpoint-frontend` | Nginx serving static frontend | `80` |
| `plot-point-plotpoint-backend` | Node.js + Express REST API | `5000` |
| `pgvector/pgvector:pg17` | PostgreSQL with pgvector extension | `5432` |

Database is persisted via a named Docker volume: `pg_vector_data`

**Navigate to the project root and run:**

```bash
# 1. Stop any existing containers and clear cached builds
docker compose down

# 2. Build images from scratch and start all services
docker compose up -d --build

# 3. Verify database initialized correctly
docker compose logs database-cont-plotpoint
```

Once running:
- **Frontend** → [http://localhost:80](http://localhost:80)
- **Backend API** → [http://localhost:5000](http://localhost:5000)

---

### Running Locally (Without Docker)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/plotpoint.git

# 2. Install backend dependencies
cd Backend
npm install

# 3. Start the server
node server.js

# 4. Open frontend
# Open Frontend/index.html in your browser
```

> **Note:** When running locally without Docker the frontend points to `http://localhost:3000`. When running inside Docker it connects to port `5000` via internal container networking.

---

### Verify Everything is Running

```bash
# Check all containers are up
docker ps

# Test the API
curl http://localhost:5000/api/movies

# Check database connection
docker exec -it database-cont-plotpoint psql -U postgres -d postgres
```
## Key Technical Decisions

**Why pgvector inside PostgreSQL instead of a standalone vector database?**
Enables combining cosine similarity search with SQL JOINs in a single query — soft AI ranking + hard relational filters together. Same pattern used by enterprise search systems.

**Why content-based filtering instead of collaborative?**
Collaborative filtering requires thousands of users to produce meaningful recommendations. Content-based works from the first liked movie — no cold start problem, no other users needed.

**Why ON DELETE SET NULL on search_logs?**
Search logs have analytical value even after a user is deleted. Genre trends, popular queries, search patterns — this data is valuable regardless of who searched. Other user data (favorites, watchlist) cascades because it has no meaning without the user.

---

## What I Learned

Without knowing it, I independently derived and implemented:

- **RAG** (Retrieval Augmented Generation)
- **Content-Based Filtering**
- **Hybrid Vector-Relational Search**
- **Cross-lingual Semantic Embeddings**
- **Vector Indexing** (ivfflat approximate nearest neighbor)
- **Data Pipeline Engineering**

---

## Author

**Pritam** — Second Year CS Student, SZABIST Karachi
Building at the intersection of databases and AI.

---

*Built as a DBMS final project. Became something real.*
