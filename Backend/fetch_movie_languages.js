const pool = require('./db');
require('dotenv').config();

async function fillMovieLanguages() {
    
    const getmovies = await pool.query(`SELECT tmdb_id, movie_id, title FROM movies`);
    const movies = getmovies.rows;
    
    for (let mov of movies) {
        try {
            const getLang = await fetch(`https://api.themoviedb.org/3/movie/${mov.tmdb_id}?api_key=${process.env.TMDB_API}`);
            const response = await getLang.json();
            const languages = response.spoken_languages || [];

            for (let lang of languages) {

                const getID = await pool.query(`SELECT language_id, name FROM languages WHERE name = $1`, [lang.english_name]);

                for (let l of getID.rows) {

                    await pool.query(
                        `INSERT INTO movie_languages(movie_id, language_id)
                        VALUES($1, $2)
                        ON CONFLICT DO NOTHING`, 
                        [mov.movie_id, l.language_id]
                    );

                    // console.log(mov.movie_id);
                    // console.log(mov.title);
                    // console.log(l.language_id);
                    // console.log(l.name);
                }
            }
            console.log("Done Insertion: " + mov.title);
            
            await new Promise(r => setTimeout(r, 200));

        } catch (err) {
            console.log(`Error processing ${mov.title}: ${err.message}`);
        }
    }
    pool.end();
}

fillMovieLanguages();