const pool = require('./db');
require('dotenv').config();

async function movie_cast() {
    const getMovies = await pool.query("SELECT tmdb_id , movie_id , title from movies");
    // console.log(getMovies.rows);

    for(let movie of getMovies.rows){
        const credits = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}/credits?api_key=${process.env.TMDB_API}`)
        const response = await credits.json();
        // const res = response.cast.slice(0,5);
        // for(let cast of res){
        //     // console.log(cast.name);
        //     const getCastID = await pool.query(`Select cast_id , name from cast_members where name = $1 and role = $2` , [cast.name , 'actor']);
        //     // console.log("Movie ID:" + movie.movie_id);
        //     // console.log(getCastID.rows[0].cast_id);
        //     // console.log("Charater :" + cast.character);
        //     // console.log("Order :" + cast.order);

        //     await pool.query(
        //         `INSERT INTO movie_cast(movie_id , cast_id , character_name , billing_order)
        //         VALUES($1 , $2 , $3 , $4)
        //         ON CONFLICT DO NOTHING
        //         ` , [movie.movie_id , getCastID.rows[0].cast_id , cast.character , cast.order]
        //     );
        // }
        // const res = response.crew;
        const directors = response.crew.filter(person => person.job === 'Director');
        // console.log(directors);

        for(let dir of directors){
            // console.log(cast.name);
            const getCastID = await pool.query(`Select cast_id , name from cast_members where name = $1 and role = $2` , [dir.name , 'director']);
            console.log("Movie ID:" + movie.movie_id);
            console.log(getCastID.rows[0].cast_id);
            // console.log("Charater :" + cast.character);
            // console.log("Order :" + cast.order);

            await pool.query(
                `INSERT INTO movie_cast(movie_id , cast_id , character_name , billing_order)
                VALUES($1 , $2 , $3 , $4)
                ON CONFLICT DO NOTHING
                ` , [movie.movie_id , getCastID.rows[0].cast_id , 'Director' , null]
            );
        }
        console.log("Inserted : " + movie.title);
    }
  }

movie_cast();
