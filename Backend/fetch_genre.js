const express = require('express');
const pool = require('./db');
require('dotenv').config();

const app = express();

app.get('/fetch-movies' ,async (req , res) =>{
    try{
        let moviesList = []
        let inserted = 0;
        const getdata = await pool.query(`Select title, tmdb_id , imdb_id from movies`);
        const result = getdata.rows;
        for (let movie of result){
            const genresapi = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${process.env.TMDB_API}`);
            const response = await genresapi.json();
            const genre = response.genres || [];
            for(let g of genre){
                await pool.query(`
                   INSERT INTO GENRES(name)
                   VALUES($1) 
                   ON CONFLICT (name) DO NOTHING
                    `, [g.name])

                inserted++;
            }
            console.log(`Processed Movie: ${movie.title}`);
            await new Promise(r => setTimeout(r, 300));
        }
        res.json({message: "Genre Filled:" , inserted});

    } catch(error){
        res.status(500).json({message : "Error fetching data"})
    }
})

app.listen(`${process.env.PORT}` , ()=>{
    console.log("Listening on PORT 3000.......");
})
