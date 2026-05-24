const pool = require('./db');
require('dotenv').config();

async function getMovieGenres() {
    const getmovies = await pool.query(`SELECT tmdb_id , movie_id , title from movies`);
    const movies = getmovies.rows;
    
    for(let mov of movies){
        const getGenres = await fetch(`https://api.themoviedb.org/3/movie/${mov.tmdb_id}?api_key=${process.env.TMDB_API}`);
        const response = await getGenres.json();

        for(let res of response.genres){
            // console.log(mov.movie_id);
            // console.log(res.name);

            const getID = await pool.query(`SELECT genre_id from genres where name = $1` , [res.name]);

            for(let g of getID.rows){
                // console.log("Movie_id: " + mov.movie_id);
                // console.log("Genre_id: " + g.genre_id);

                await pool.query(
                    `INSERT INTO movie_genres(movie_id , genre_id)
                    VALUES($1 , $2)
                    ON CONFLICT DO NOTHING
                    `, [mov.movie_id , g.genre_id]
                );

            }

        }
        console.log("Done Insertion: " + mov.title);
    }
}

getMovieGenres();