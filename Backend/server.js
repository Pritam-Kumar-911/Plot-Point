require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// ── MOVIES ──────────────────────────────────────────
app.get('/api/movies', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.movie_id, m.title, m.rating, m.poster_url, m.release_year,
                   STRING_AGG(g.name, ', ') as genres
            FROM movies m
            LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
            LEFT JOIN genres g ON mg.genre_id = g.genre_id
            GROUP BY m.movie_id, m.title, m.rating, m.poster_url, m.release_year
            ORDER BY m.rating DESC
            LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ message: "Error fetching movies" });
    }
});

// ── USERS ───────────────────────────────────────────
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(`SELECT user_id, username FROM users`);
        res.json(result.rows);
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ message: "Error fetching users" });
    }
});

// ── SEARCH ──────────────────────────────────────────
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.prompt;
        if (!query) return res.status(400).json({ message: "Query is required" });

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: query }] }
                })
            }
        );

        const data = await geminiResponse.json();
        const vector = data.embedding.values;

        const result = await pool.query(`
            SELECT 
                m.movie_id, m.title, m.rating, m.poster_url, 
                m.description, m.release_year,
                STRING_AGG(g.name, ', ') as genres,
                ROUND(CAST((1 - (m.description_vector <=> $1::vector)) * 100 AS numeric), 2) AS match_percentage
            FROM movies m
            LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
            LEFT JOIN genres g ON mg.genre_id = g.genre_id
            WHERE m.description_vector IS NOT NULL
            GROUP BY m.movie_id, m.title, m.rating, m.poster_url, m.description, m.release_year
            ORDER BY m.description_vector <=> $1::vector
            LIMIT 20
        `, [`[${vector.join(',')}]`]);


        // RAG — generate AI explanation for top match
        let aiExplanation = null;
        if (result.rows.length > 0) {
            const topMovie = result.rows[0];
            const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash'];

            for (let modelName of modelsToTry) {
                try {
                    const geminiTextResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: `You are a movie match assistant. The user searched for: "${query}". 
                                        Our top match is "${topMovie.title}": "${topMovie.description}".
                                        Write a conversational 2-sentence explanation of why this movie fits the search.`
                                    }]
                                }]
                            })
                        }
                    );

                    const textData = await geminiTextResponse.json();
                    if (textData.error) throw new Error(textData.error.message);

                    const extracted = textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                    if (extracted) { aiExplanation = extracted; break; }

                } catch (err) {
                    console.log(`Model ${modelName} failed: ${err.message}`);
                }
            }
        }

        res.json({
            query,
            ai_explanation: aiExplanation,
            result: result.rows
        });

    } catch (err) {
        console.log(err.message);
        res.status(500).json({ message: "Search failed" });
    }
});

// ── FAVORITES ───────────────────────────────────────
app.post('/api/favorites/toggle', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        const check = await pool.query(
            `SELECT * FROM user_favorites WHERE user_id = $1 AND movie_id = $2`,
            [user_id, movie_id]
        );
        if (check.rows.length > 0) {
            await pool.query(
                `DELETE FROM user_favorites WHERE user_id = $1 AND movie_id = $2`,
                [user_id, movie_id]
            );
            return res.json({ status: "removed" });
        } else {
            await pool.query(
                `INSERT INTO user_favorites (user_id, movie_id) VALUES ($1, $2)`,
                [user_id, movie_id]
            );
            return res.json({ status: "added" });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/favorites/:user_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.movie_id, m.title, m.rating, m.poster_url, m.release_year
            FROM user_favorites uf
            JOIN movies m ON uf.movie_id = m.movie_id
            WHERE uf.user_id = $1
        `, [req.params.user_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── WATCHLIST ───────────────────────────────────────
app.post('/api/watchlist', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        await pool.query(
            `INSERT INTO watchlist (user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [user_id, movie_id]
        );
        res.status(201).json({ message: "Added to watchlist" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/watchlist/:user_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.movie_id, m.title, m.rating, m.poster_url, m.release_year,
                   w.watched, w.watched_at
            FROM watchlist w
            JOIN movies m ON w.movie_id = m.movie_id
            WHERE w.user_id = $1
        `, [req.params.user_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/watchlist', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        await pool.query(
            `DELETE FROM watchlist WHERE user_id = $1 AND movie_id = $2`,
            [user_id, movie_id]
        );
        res.json({ message: "Removed from watchlist" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.patch('/api/watchlist/watched', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        await pool.query(`
            UPDATE watchlist SET watched = TRUE, watched_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND movie_id = $2
        `, [user_id, movie_id]);
        res.json({ message: "Marked as watched" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── REVIEWS ─────────────────────────────────────────
app.post('/api/reviews', async (req, res) => {
    const { user_id, movie_id, review_text } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO reviews (user_id, movie_id, review_text)
            VALUES ($1, $2, $3) RETURNING *
        `, [user_id, movie_id, review_text]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/reviews/:movie_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.review_id, r.review_text, r.created_at, u.username
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.movie_id = $1
            ORDER BY r.created_at DESC
        `, [req.params.movie_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/reviews/:review_id', async (req, res) => {
    const { review_text } = req.body;
    try {
        const result = await pool.query(`
            UPDATE reviews SET review_text = $1
            WHERE review_id = $2 RETURNING *
        `, [review_text, req.params.review_id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/reviews/:review_id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM reviews WHERE review_id = $1`, [req.params.review_id]);
        res.json({ message: "Review deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── RATINGS ─────────────────────────────────────────
app.post('/api/ratings', async (req, res) => {
    const { user_id, movie_id, rating_value } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO ratings (user_id, movie_id, rating_value)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, movie_id) 
            DO UPDATE SET rating_value = $3
            RETURNING *
        `, [user_id, movie_id, rating_value]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/ratings/:movie_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT AVG(rating_value) as average_rating, COUNT(*) as total_ratings
            FROM ratings WHERE movie_id = $1
        `, [req.params.movie_id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── MOVIE DETAIL ─────────────────────────────────────
app.get('/api/movies/:id', async (req, res) => {
    try {
        const movie = await pool.query(`
            SELECT m.*, STRING_AGG(DISTINCT g.name, ', ') as genres
            FROM movies m
            LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
            LEFT JOIN genres g ON mg.genre_id = g.genre_id
            WHERE m.movie_id = $1
            GROUP BY m.movie_id
        `, [req.params.id]);

        const cast = await pool.query(`
            SELECT cm.name, cm.role, mc.character_name, mc.billing_order
            FROM movie_cast mc
            JOIN cast_members cm ON mc.cast_id = cm.cast_id
            WHERE mc.movie_id = $1
            ORDER BY mc.billing_order
        `, [req.params.id]);

        res.json({
            movie: movie.rows[0],
            cast: cast.rows
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── SEARCH LOGS ──────────────────────────────────────
app.post('/api/search-log', async (req, res) => {
    const { user_id, query_text, results_returned } = req.body;
    try {
        await pool.query(`
            INSERT INTO search_logs (user_id, query_text, results_returned)
            VALUES ($1, $2, $3)
        `, [user_id || null, query_text, results_returned]);
        res.json({ message: "Logged" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── DASHBOARD ────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
    try {
        const totalMovies = await pool.query(`SELECT COUNT(*) FROM movies`);
        const totalUsers = await pool.query(`SELECT COUNT(*) FROM users`);
        const totalSearches = await pool.query(`SELECT COUNT(*) FROM search_logs`);
        const totalFavorites = await pool.query(`SELECT COUNT(*) FROM user_favorites`);

        const genrePopularity = await pool.query(`
            SELECT g.name, COUNT(uf.movie_id) as total
            FROM genres g
            JOIN movie_genres mg ON g.genre_id = mg.genre_id
            JOIN user_favorites uf ON mg.movie_id = uf.movie_id
            GROUP BY g.name ORDER BY total DESC
        `);

        const topRated = await pool.query(`
            SELECT title, rating FROM movies
            ORDER BY rating DESC LIMIT 10
        `);

        res.json({
            stats: {
                total_movies: totalMovies.rows[0].count,
                total_users: totalUsers.rows[0].count,
                total_searches: totalSearches.rows[0].count,
                total_favorites: totalFavorites.rows[0].count
            },
            genre_popularity: genrePopularity.rows,
            top_rated: topRated.rows
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── START SERVER ─────────────────────────────────────
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});