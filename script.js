let aiMode = true;

function toggleAI() {
  const btn = document.getElementById("toggleBtn");
  aiMode = !aiMode;
  btn.classList.toggle("active");
}

// Dummy data (replace with API)
const movies = [
  {
    title: "Drishyam",
    year: 2015,
    sentiment: "Clever",
    rating: 8.2,
    plot: "A man protects his family...",
    insight: "Matches your request for a clever thriller in a small-town setting."
  },
  {
    title: "Inception",
    year: 2010,
    sentiment: "Mind-bending",
    rating: 8.8,
    plot: "Dream within a dream...",
    insight: "Recommended due to layered narrative and psychological depth."
  }
];

function renderMovies(list) {
  const grid = document.getElementById("movieGrid");
  grid.innerHTML = "";

  list.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <div class="poster"></div>
      <div class="movie-info">
        <h4>${movie.title} (${movie.year})</h4>
        <div class="badge">${movie.sentiment}</div>
        <p>⭐ ${movie.rating}</p>
      </div>
    `;

    card.onclick = () => openModal(movie);

    grid.appendChild(card);
  });
}

function handleSearch() {
  const query = document.getElementById("searchInput").value;
  console.log("Search:", query, "AI Mode:", aiMode);

  // Replace with backend API call
  renderMovies(movies);
}

// Modal
function openModal(movie) {
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modalTitle").innerText = movie.title;
  document.getElementById("modalPlot").innerText = movie.plot;
  document.getElementById("modalInsight").innerText = movie.insight;
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

// Dashboard Dummy Data
document.getElementById("lastScrape").innerText = "2026-04-15 10:30 PM";
document.getElementById("totalMovies").innerText = "1245";

const logs = ["Added: Inception", "Added: Drishyam"];
const logList = document.getElementById("logList");

logs.forEach(log => {
  const li = document.createElement("li");
  li.innerText = log;
  logList.appendChild(li);
});

// Initial render
renderMovies(movies);