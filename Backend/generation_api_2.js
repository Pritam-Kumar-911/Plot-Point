require('dotenv').config();
const express = require('express');
const pool = require('./db');
const app = express();

app.get('/api/search', async (req, res) => {
    console.log(req.query.prompt);
    
    try {
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: `${req.query.prompt}` }] }
            })
        });

        const data = await geminiResponse.json();
        const vector = data.embedding.values;

        const result = await pool.query(`
            SELECT movie_id , title ,rating , poster_url , description , release_year,
            ROUND(CAST((1 - (description_vector <=> $1::vector)) * 100 AS numeric), 2) AS match_percentage
            from movies 
            where description_vector is not null
            order by description_vector <=> $1::vector
            LIMIT 20
        `, [`[${vector.join(',')}]`]);

        let aiExplanation = "No explanation could be generated at this time.";
        
        if (result.rows.length > 0) {
            const topMovie = result.rows[0];
            const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash'];
            
            for (let modelName of modelsToTry) {
                try {
                    console.log(`Attempting explanation with model: ${modelName}`);
                    
                    const geminiTextResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: `You are a movie match assistant. The user searched for: "${req.query.prompt}". 
                                                Our top database match is "${topMovie.title}" with this description: "${topMovie.description}".
                                                Write a conversational, 2-sentence explanation to the user showing how this movie relates to their search vibe or why they should check it out based on their intent. Keep it engaging, positive, and direct. Do not say that the movie does not match.`
                                    }]
                                }]
                            })
                        }
                    );

                    const textData = await geminiTextResponse.json();

                    if (textData.error) {
                        throw new Error(`Model ${modelName} failed: ${textData.error.message}`);
                    }

                    const extractedText = textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                    
                    if (extractedText) {
                        aiExplanation = extractedText;
                        console.log(`Success with model: ${modelName}`);
                        break; // Breaks the loop completely so we can proceed to res.json()
                    }

                } catch (textErr) {
                    console.log(`Error inside loop: ${textErr.message}`);
                    // Loop naturally moves to the next model
                }
            }
        }

        // CRITICAL: Ensure this is completely outside your loops so it ALWAYS fires a response
        return res.json({
            query: req.query.prompt,
            ai_recommendation_reason: aiExplanation, 
            result: result.rows
        });

    } catch (globalErr) {
        console.error("Global Route Error:", globalErr);
        // If anything catastrophic breaks earlier in the script, this ensures the client doesn't hang
        return res.status(500).json({ error: globalErr.message });
    }
});

app.listen(`${process.env.PORT}` , ()=>{
    console.log(`Listening on port ${process.env.PORT} ......`);
})