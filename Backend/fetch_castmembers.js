const express = require('express');
const pool = require('./db');
require('dotenv').config();

async function getcast() {
    let movies_count = 0;
    const getdata = await pool.query(`SELECT tmdb_id , movie_id , title from movies`);
    for(let movie of getdata.rows){

        const getcast = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}/credits?api_key=${process.env.TMDB_API}`);
        const response = await getcast.json();
        console.log(movie.title);
        const actors = response.cast.slice(0, 5)
        
        const directors = response.crew.filter(person => person.job === 'Director');

        let count = 0;

        for(let each of directors){
            await pool.query(
                `INSERT INTO cast_members(name , role)
                VALUES($1 , $2)
                ON CONFLICT (name , role) DO NOTHING
                ` , [each.name , 'director']
            )
        }

        console.log("Inserted: " + movie.title);
        // console.log(slicedDirectors);

        
        for(let cast of actors){
            // console.log(cast.id + " " + cast.name + " " + cast.job);
            await pool.query(
                `INSERT INTO cast_members(name , role)
                 VALUES($1 , $2)
                 ON CONFLICT (name , role) DO NOTHING
                ` , [cast.name , 'actor']
            )
            count++;
        }
        
    }
}


