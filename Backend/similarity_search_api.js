require('dotenv').config();
const express = require('express');
const pool = require('./db');
const app = express();

app.get('/home' , async (req , res) => {
    console.log(req.query.prompt);
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                content: {
                    parts: [
                        {
                            text: `${req.query.prompt}`
                        }
                    ]
                }
            })
        }
    )

    const data = await geminiResponse.json();
    const vector = data.embedding.values;
    // console.log(vector);

    const result = await pool.query(`
        SELECT movie_id , title ,rating , poster_url , description , release_year,
        ROUND(CAST((1 - (description_vector <=> $1::vector)) * 100 AS numeric), 2) AS match_percentage
        from movies 
        where description_vector is not null
        order by description_vector <=> $1::vector
        LIMIT 20
        ` , [`[${vector.join(',')}]`]);

    res.json({
        query: req.query.prompt,
        result: result.rows
    })
})

app.listen(`${process.env.PORT}` , ()=>{
    console.log(`Listening on port ${process.env.PORT} ......`);
})
