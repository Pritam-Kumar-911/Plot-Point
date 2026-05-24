const express = require('express');
const pool = require('./db');
const { fail } = require('node:assert');
require('dotenv').config();

const app = express();

app.get('/home' , async (req , res) =>{
    let updated = 0;
    let failed = 0;
    try{
        const getMovies = await pool.query(`SELECT movie_id , tmdb_id , title from movies`);
        const result = getMovies.rows;
        
        for(let movie of result){
            const response = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${process.env.TMDB_API}`)
            const data = await response.json();
            
            await pool.query(`
                UPDATE movies 
                SET runtime_mins = $1 , imdb_id = $2
                WHERE tmdb_id = $3
                `,[data.runtime , data.imdb_id , movie.tmdb_id]
            )
            updated++;
            console.log(`Updated: ${movie.title}`);
            await new Promise(r => setTimeout(r, 300));
        }
        
    }
    catch(error){
        failed++;
        res.status(500).json({message: "Error getting data"});
    }

    res.json({message: "Done" , updated , failed});
     
});

app.listen(3000 , ()=>{
    console.log("Listening to port 3000.....");
})