require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

//__Explore Page__________

app.get('/api/explore/:genre' , async(req , res) => {
    try{
        const response = await pool.query(`
        select poster_url , m.movie_id , title , rating from movies m inner join movie_genres mg on m.movie_id = mg.movie_id inner join genres g on g.genre_id = mg.genre_id where g.name = $1 limit 15;
        ` , [req.params.genre])
        res.json(response.rows);
    }
    catch(err){
        res.status(500).json({message: "Error fetching movies"});
    }
})

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
// app.post('/api/reviews', async (req, res) => {
//     const { user_id, movie_id, review_text } = req.body;
//     try {
//         const result = await pool.query(`
//             INSERT INTO reviews (user_id, movie_id, review_text)
//             VALUES ($1, $2, $3) RETURNING *
//         `, [user_id, movie_id, review_text]);
//         res.status(201).json(result.rows[0]);
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });

app.post('/api/reviews' , async(req , res) => {
    const {user_id , movie_id , review_text} = req.body;
    try{
        const result = await pool.query(`
            INSERT INTO reviews(user_id , movie_id , review_text)
            VALUES($1 , $2 , $3) 
            ON CONFLICT (user_id, movie_id) 
            DO UPDATE SET review_text = $3
            RETURNING *
            `, [user_id , movie_id , review_text]);
            res.status(201).json(result.rows[0]);
    }catch(err){
        res.status(500).json({message: err.message});
    }
})



app.get('/api/reviews/:movie_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.user_id, r.review_id, r.review_text, r.created_at, u.username
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
// app.get('/api/movies/:id', async (req, res) => {
//     try {
//         const movie = await pool.query(`
//             SELECT m.*, STRING_AGG(DISTINCT g.name, ', ') as genres
//             FROM movies m
//             LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
//             LEFT JOIN genres g ON mg.genre_id = g.genre_id
//             WHERE m.movie_id = $1
//             GROUP BY m.movie_id
//         `, [req.params.id]);

//         const cast = await pool.query(`
//             SELECT cm.name, cm.role, mc.character_name, mc.billing_order
//             FROM movie_cast mc
//             JOIN cast_members cm ON mc.cast_id = cm.cast_id
//             WHERE mc.movie_id = $1
//             ORDER BY mc.billing_order
//         `, [req.params.id]);

//         res.json({
//             movie: movie.rows[0],
//             cast: cast.rows
//         });
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });

//movie details api fetch 
app.get('/api/movies/:id' , async(req , res) => {
    try{
        const movies = await pool.query(`
             SELECT m.movie_id , m.tmdb_id , m.imdb_id , m.title , m.description, m.release_year , m.runtime_mins , rating , m.poster_url, STRING_AGG(DISTINCT g.name, ', ') as genres
             FROM movies m
             inner JOIN movie_genres mg ON m.movie_id = mg.movie_id
             inner JOIN genres g ON mg.genre_id = g.genre_id
             WHERE m.movie_id = $1 group by m.movie_id;
            `, [req.params.id]);

            const cast = await pool.query(`
             SELECT cm.name, cm.role, mc.character_name, mc.billing_order
             FROM movie_cast mc
             JOIN cast_members cm ON mc.cast_id = cm.cast_id
             WHERE mc.movie_id = $1 and role = 'actor'
             ORDER BY mc.billing_order
            `, [req.params.id]);

            const directors = await pool.query(`
             SELECT cm.name, cm.role, mc.character_name, mc.billing_order
             FROM movie_cast mc
             JOIN cast_members cm ON mc.cast_id = cm.cast_id
             WHERE mc.movie_id = $1
             and role = 'director'
            `, [req.params.id]);   


            res.json({
                movie : movies.rows[0],
                cast : cast.rows,
                directors : directors.rows
            });
    }
    catch(err){
        res.status(500).json({message: err.message});
    }
})



// ── SEARCH LOGS ──────────────────────────────────────
app.post('/api/search-log', async (req, res) => {
    const { user_id, query_text, results_returned ,match_percentage, top_movie } = req.body;
    try {
        await pool.query(`
            INSERT INTO search_logs (user_id, query_text, results_returned , match_percentage, top_movie)
            VALUES ($1, $2, $3 , $4 , $5)
        `, [user_id || null, query_text, results_returned , match_percentage , top_movie]);
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

//dashboard


//sementic search box 
app.get('/api/dashboard/sementic-insights' , async(req , res)=> {
    try{
        const getRows = await pool.query(`
            select query_text , title , match_percentage , searched_at from search_logs sl inner join movies m on m.movie_id = sl.top_movie order by search_id limit 3;
            `)
        res.json(getRows.rows);    
    }
    catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//main header details "
app.get('/api/dashboard/header' , async(req , res)=>{
    try{
        const getHeader = await pool.query(`
            select * from getData;
            `)
        res.json(getHeader.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//top 5 movies
app.get('/api/dashboard/topmovies' , async(req , res)=>{
    try{
        const getHeader = await pool.query(`
            SELECT
                m.title,
                STRING_AGG(DISTINCT g.name, ', ') AS genres,
                ROUND(AVG(r.rating_value), 2) AS avg_rating,
                m.poster_url
            FROM movies m
            JOIN movie_genres mg ON m.movie_id = mg.movie_id
            JOIN genres g ON g.genre_id = mg.genre_id
            JOIN ratings r ON r.movie_id = m.movie_id
            GROUP BY m.movie_id, m.title
            ORDER BY avg_rating DESC
            LIMIT 5;
            `)
        res.json(getHeader.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//most active users
app.get('/api/dashboard/activeusers' , async(req , res)=>{
    try{
        const getHeader = await pool.query(`
            SELECT
                u.username,
                COUNT(DISTINCT r.review_id) AS total_reviews,
                ROUND(AVG(rt.rating_value), 2) AS avg_rating_given
            FROM users u
            LEFT JOIN reviews r
                ON u.user_id = r.user_id
            LEFT JOIN ratings rt
                ON u.user_id = rt.user_id
            GROUP BY u.user_id, u.username
            ORDER BY total_reviews DESC;
            `)
        res.json(getHeader.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//most favorited movies 
app.get('/api/dashboard/mostfavorited' , async(req , res)=>{
    try{
        const getHeader = await pool.query(`
            select title , count(fav_id) from movies m inner join user_favorites uf on m.movie_id = uf.movie_id group by title order by count(fav_id) desc limit 4;
            `)
        res.json(getHeader.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//rating distribution 
app.get('/api/dashboard/ratingdist' , async(req , res)=>{
    try{
        const getRatings = await pool.query(`
            select rating_value , count(movie_id) from ratings group by rating_value order by rating_value desc;
            `)
        res.json(getRatings.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//movies per genre
app.get('/api/dashboard/moviesPerGenre' , async(req , res)=>{
    try{
        const getMovies = await pool.query(`
            select name , count(m.movie_id) from movies m inner join movie_genres mg on m.movie_id = mg.movie_id inner join genres on mg.genre_id = genres.genre_id group by name limit 4;
            `)
        res.json(getMovies.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//avg ratings per genre
app.get('/api/dashboard/avgrating' , async(req , res)=>{
    try{
        const getAvg = await pool.query(`
            select name , ROUND(AVG(r.rating_value), 2) from ratings r inner join movie_genres mg on r.movie_id = mg.movie_id inner join genres g on g.genre_id = mg.genre_id group by name order by ROUND(AVG(r.rating_value), 2) desc limit 5;
            `)
        res.json(getAvg.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})

//movies by release year 
app.get('/api/dashboard/releaseyear' , async(req , res)=>{
    try{
        const getMovies = await pool.query(`
            SELECT
                (FLOOR(release_year / 10) * 10)::int AS decade,
                COUNT(*) AS movie_count
            FROM movies
            WHERE release_year IS NOT NULL
            GROUP BY decade
            ORDER BY decade ASC;
            `)
        res.json(getMovies.rows);    
    }catch(error){
        res.status(500).json({message: "Error fetching data"});
    }
})


// ── START SERVER ─────────────────────────────────────
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});