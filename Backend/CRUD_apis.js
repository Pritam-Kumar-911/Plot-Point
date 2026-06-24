const express = require('express');
const router = express.Router();
const pool = require('../db'); // Adjust path to your db config

// ==========================================
// 1. WATCHLIST CRUD
// ==========================================

// ADD movie to watchlist
router.post('/api/watchlist', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        await pool.query(`
            INSERT INTO watchlist (user_id, movie_id) 
            VALUES ($1, $2) 
            ON CONFLICT DO NOTHING
        `, [user_id, movie_id]);
        
        res.status(201).json({ message: "Movie added to watchlist successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET user's watchlist (with movie details)
router.get('/api/watchlist/:user_id', async (req, res) => {
    const { user_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT m.movie_id, m.title, m.poster_url, m.rating, m.release_year 
            FROM watchlist w
            INNER JOIN movies m ON w.movie_id = m.movie_id
            WHERE w.user_id = $1
        `, [user_id]);
        
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE movie from watchlist
router.delete('/api/watchlist', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        await pool.query(`
            DELETE FROM watchlist 
            WHERE user_id = $1 AND movie_id = $2
        `, [user_id, movie_id]);
        
        res.json({ message: "Movie removed from watchlist" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 2. REVIEWS CRUD
// ==========================================

// ADD a review
router.post('/api/reviews', async (req, res) => {
    const { user_id, movie_id, review_text, rating } = req.body; 
    // Note: If you keep ratings separate, omit rating here
    try {
        const newReview = await pool.query(`
            INSERT INTO reviews (user_id, movie_id, review_text) 
            VALUES ($1, $2, $3) 
            RETURNING *
        `, [user_id, movie_id, review_text]);
        
        res.status(201).json({ message: "Review posted successfully", review: newReview.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all reviews for a specific movie
router.get('/api/reviews/movie/:movie_id', async (req, res) => {
    const { movie_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT r.review_text, u.username, r.user_id
            FROM reviews r
            INNER JOIN users u ON r.user_id = u.user_id
            WHERE r.movie_id = $1
        `, [movie_id]);
        
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE a review
router.put('/api/reviews/:review_id', async (req, res) => {
    const { review_id } = req.params;
    const { review_text } = req.body;
    try {
        const updated = await pool.query(`
            UPDATE reviews 
            SET review_text = $1 
            WHERE review_id = $2
            RETURNING *
        `, [review_text, review_id]);
        
        res.json({ message: "Review updated successfully", review: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a review
router.delete('/api/reviews/:review_id', async (req, res) => {
    const { review_id } = req.params;
    try {
        await pool.query(`DELETE FROM reviews WHERE review_id = $1`, [review_id]);
        res.json({ message: "Review deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 3. USER FAVORITES CRUD
// ==========================================

// TOGGLE Favorite (Inserts if missing, Deletes if exists)
router.post('/api/favorites/toggle', async (req, res) => {
    const { user_id, movie_id } = req.body;
    try {
        // Check if already favorited
        const check = await pool.query(`SELECT * FROM user_favorites WHERE user_id = $1 AND movie_id = $2`, [user_id, movie_id]);
        
        if (check.rows.length > 0) {
            await pool.query(`DELETE FROM user_favorites WHERE user_id = $1 AND movie_id = $2`, [user_id, movie_id]);
            return res.json({ status: "removed", message: "Removed from favorites" });
        } else {
            await pool.query(`INSERT INTO user_favorites (user_id, movie_id) VALUES ($1, $2)`, [user_id, movie_id]);
            return res.json({ status: "added", message: "Added to favorites" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;