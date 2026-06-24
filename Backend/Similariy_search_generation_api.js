require('dotenv').config();
const express = require('express');
const pool = require('./db');
const app = express();

app.get('/api/search' , async (req , res) => {
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

    const result = await pool.query(`
        SELECT movie_id , title ,rating , poster_url , description , release_year,
        ROUND(CAST((1 - (description_vector <=> $1::vector)) * 100 AS numeric), 2) AS match_percentage
        from movies 
        where description_vector is not null
        order by description_vector <=> $1::vector
        LIMIT 20
        ` , [`[${vector.join(',')}]`]);

    // ==========================================
    // ADDED: GENERATE AI EXPLANATION FOR TOP MATCH
    // ==========================================
//     let aiExplanation = null;
    
//     if (result.rows.length > 0) {
//         const topMovie = result.rows[0]; // Take the #1 matched movie from your query array

//         try {
//             const geminiTextResponse = await fetch(
//                 `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
//                 {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         contents: [{
//                             parts: [{
//                                 text: `You are a movie recommendation assistant. A user searched for: "${req.query.prompt}". 
//                                 Our system matched it with the movie "${topMovie.title}" (Description: "${topMovie.description}").
//                                 Based on the user's search intent and the movie description, write a concise, conversational explanation (max 2 sentences) explaining why this movie is a great match.`
//                             }]
//                         }]
//                     })
//                 }
//             );

//             const textData = await geminiTextResponse.json();
//             console.log("Gemini Raw Response:", JSON.stringify(textData)); // Check your terminal console!
//             aiExplanation = textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
//         } catch (textErr) {
//             console.log("Failed to generate AI explanation text:", textErr.message);
//         }
//     }
//     // ==========================================

//     // res.json({
//     //     query: req.query.prompt,
//     //     ai_recommendation_reason: aiExplanation, // This will show up in your frontend JSON response
//     //     result: result.rows
//     // })
//     res.json({
//     query: req.query.prompt,
//     ai_recommendation_reason: aiExplanation || "AI generation failed or returned empty.", 
//     result: result.rows
// });
        let aiExplanation = null;
    
    if (result.rows.length > 0) {
        const topMovie = result.rows[0];

        // Define an array of models to try in order of preference
        const modelsToTry = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
        
        for (let modelName of modelsToTry) {
            try {
                console.log(`Attempting explanation with model: ${modelName}`);
                
                const geminiTextResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `You are a movie recommendation assistant. A user searched for: "${req.query.prompt}". 
                                    Our system matched it with the movie "${topMovie.title}" (Description: "${topMovie.description}").
                                    Based on this, write a concise, conversational explanation (max 2 sentences) explaining why this movie fits.`
                                }]
                            }]
                        })
                    }
                );

                const textData = await geminiTextResponse.json();

                // If we get a 503 or 429 error, throw it to jump to the next model in the catch block
                if (textData.error) {
                    throw new Error(`Model ${modelName} failed: ${textData.error.message}`);
                }

                aiExplanation = textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                
                // If we successfully got text, break out of the loop!
                if (aiExplanation) {
                    console.log(`Success with model: ${modelName}`);
                    break; 
                }

            } catch (textErr) {
                console.log(textErr.message);
                // Loop continues to the next model automatically
            }
        }
    }
})

app.listen(`${process.env.PORT}` , ()=>{
    console.log(`Listening on port ${process.env.PORT} ......`);
})