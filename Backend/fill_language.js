const pool = require('./db');
require('dotenv').config();

async function fillLanguages() {
    const getMovies = await pool.query(`SELECT tmdb_id, title FROM movies`);
    let inserted = 0;

    for (let movie of getMovies.rows) {
        try {
            const response = await fetch(
                `https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${process.env.TMDB_API}`
            );
            const data = await response.json();
            const languages = data.spoken_languages || [];
            // console.log(languages);

            for (let lang of languages) {
                await pool.query(`
                    INSERT INTO languages (name)
                    VALUES ($1)
                    ON CONFLICT (name) DO NOTHING
                `, [lang.english_name]);
                inserted++;
            }

            console.log(`Processed: ${movie.title}`);
            await new Promise(r => setTimeout(r, 300));

        } catch (err) {
            console.log(`Failed: ${movie.title} — ${err.message}`);
        }
    }

    console.log(`Done. Inserted: ${inserted}`);
    pool.end();
}

fillLanguages();