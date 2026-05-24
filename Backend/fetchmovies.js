const API_KEY = "16ede4510682a36d922e989774c6d98a";

async function getTopMovies() {
  let allMovies = [];

  for (let page = 1; page <= 13; page++) {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&page=${page}`
    );

    const data = await res.json();
    allMovies = allMovies.concat(data.results);
  }

  const top250 = allMovies.slice(0, 250);

  top250.forEach(movie => {
    console.log(movie.title);
  });
}

getTopMovies();