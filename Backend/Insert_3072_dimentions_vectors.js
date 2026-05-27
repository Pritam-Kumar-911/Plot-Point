require('dotenv').config();
const pool = require('./db');

async function insertVectors () {
    const getData = await pool.query(`SELECT m.movie_id, title , description , string_agg(name , ', ') as genres from movies m inner join movie_genres mg on m.movie_id = mg.movie_id inner join genres g on mg.genre_id = g.genre_id WHERE vector_dims(description_vector) != 3072
   OR description_vector IS NULL group by title , description , m.movie_id`);

     console.log(`Processing ${getData.rows.length} movies...`);
    // console.log(getData.rows);
    for(let movie of getData.rows){
        try{
        const combinedText = `${movie.title}. ${movie.genres}. ${movie.description}`
        // console.log(combinedText);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    content: {parts: [{text: combinedText}]}
                })
            }
        );
        const data = await geminiResponse.json();
        if (data.error) {
        console.log(`Gemini error for ${movie.title}: ${data.error.message}`);
        continue;
}

        const vector = data.embedding.values;
        console.log(`Done: ${movie.title} — vector length: ${vector.length}`);
        // console.log(data);
        // console.log(vector);
        // delay to respect rate limits
            

            await pool.query(`
                UPDATE movies SET description_vector = $1 WHERE movie_id = $2
                `, [`[${vector.join(',')}]`, movie.movie_id]);

            await new Promise(r => setTimeout(r, 1000));
        }
        catch(err){
            console.log(`Failed: ${movie.title} — ${err.message}`);
        }
    }
    console.log('All done.');
    pool.end();   
}

insertVectors();