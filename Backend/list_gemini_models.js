require('dotenv').config();

async function listModels() {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );

    const data = await res.json();

    // console.log(JSON.stringify(data, null, 2));
    // console.log(data);
    for(let names of data.models){
        console.log(names.name);
    }
}

listModels();
