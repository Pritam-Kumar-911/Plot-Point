const express = require('express');
const pool = require('./db');
require('dotenv').config();

const app = express();

app.get('/api/movies' , async(req , res) => {
    try{
        const getMovies = await pool.query(`SELECT m.movie_id , title, rating , poster_url, string_agg(name , ', ') as genres from movies m inner join movie_genres mg on m.movie_id = mg.movie_id inner join genres g on g.genre_id = mg.genre_id group by title , rating , poster_url , m.movie_id order by rating desc limit 10`);

        const movies = getMovies.rows;
        res.json(movies);
    } catch(err){
        console.log(err.message)
        res.status(500).json({message: "Internal Server Error"});
    }  
})

app.listen(`${process.env.PORT}` , ()=>{
    console.log(`Listening on PORT ${process.env.PORT}....`);
})
