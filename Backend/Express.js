require('dotenv').config();
const express = require('express');
const pool = require('./db');

const app = express();

app.get('/home', async (req, res) => {
    try {
        let allmovies = [];
        

        for (let page = 1; page <= 13; page++) {
            const response = await fetch(
                `https://api.themoviedb.org/3/movie/top_rated?api_key=${process.env.TMDB_API}&page=${page}`
            );

            const data = await response.json();
            allmovies = allmovies.concat(data.results);
        }

        // keep only first 250 movies
        allmovies = allmovies.slice(0, 250);



        // insert into database
        console.log(`Starting insertion of ${allmovies.length} movies...`);
        for (let m of allmovies) {
            const poster_url = m.poster_path
                ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
                : null;
            const release_year = m.release_date
                ? parseInt(m.release_date.split('-')[0])
                : null;

           await pool.query(`
                UPDATE movies
                SET poster_url = $1, release_year = $2
                WHERE tmdb_id = $3
            `, [poster_url, release_year, m.id]);

            console.log(`Updated basic: ${m.title}`);
        }

        res.json({ message: "Basic attributes updated" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error updating basic attributes" });
    }
    
});

app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

pool.query("SELECT NOW()")
  .then(res => console.log("🟢 DB OK:", res.rows[0]))
  .catch(err => console.log("🔴 DB FAIL:", err.message));

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
    
});