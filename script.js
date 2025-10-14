// ⚙️ CONFIGURATION - UPDATE AFTER DEPLOYING BACKEND
const BACKEND_URL = "https://ez-streaming-api-t23a.vercel.app/"; // Replace with your Vercel URL
// Example: "https://ez-streaming-api-g3k2m9.vercel.app"

const IMG_BASE = "https://image.tmdb.org/t/p/w500";

const playerDiv = document.getElementById("player");
const continueDiv = document.getElementById("continueWatching");
const loadingSpinner = document.getElementById("loadingSpinner");

// ---- State Management ----
let historyData = [];
let currentlyPlaying = null;
let isLoading = false;

function loadHistory() {
  historyData = JSON.parse(localStorage.getItem("history") || "[]");
}

function saveHistory() {
  localStorage.setItem("history", JSON.stringify(historyData));
}

function showLoading(show = true) {
  isLoading = show;
  if (loadingSpinner) {
    loadingSpinner.style.display = show ? "flex" : "none";
  }
}

// ---- API Call Helper ----
async function apiCall(endpoint, params = {}) {
  try {
    showLoading(true);
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/tmdb${endpoint}${queryString ? "?" + queryString : ""}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    showLoading(false);
    return data;
  } catch (err) {
    console.error("API Error:", err);
    showLoading(false);
    showError("Failed to load data. Please try again.");
    return null;
  }
}

function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// ---- Helper: Create Movie/TV Card ----
function createMovieCard(movie, type = "movie") {
  const card = document.createElement("div");
  card.className = "movie-card";

  if (!movie.poster_path) return null;

  let entry = historyData.find(m => m.id === movie.id && m.type === type);
  let percent = entry && entry.duration ? (entry.progress / entry.duration) * 100 : 0;

  const title = movie.title || movie.name || "Unknown";
  
  card.innerHTML = `
    <div class="card-image-wrapper">
      <img src="${IMG_BASE + movie.poster_path}" alt="${title}" loading="lazy">
      ${percent > 0 ? `<div class="progress-bar" style="width:${percent}%"></div>` : ""}
    </div>
    <p>${title}</p>
  `;

  card.onclick = () => {
    loadPlayer(movie.id, type, title);
    document.querySelectorAll('.movie-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
  };

  return card;
}

// ---- Fetch Movies or TV ----
async function fetchMovies(endpoint, containerId, type = "movie") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  const data = await apiCall(endpoint);
  
  if (!data || !data.results) {
    container.innerHTML = `<p class="placeholder">No content found</p>`;
    return;
  }

  data.results
    .filter(item => item.poster_path)
    .forEach(item => {
      const card = createMovieCard(item, type);
      if (card) container.appendChild(card);
    });
}

// ---- Load Vidking Player ----
function loadPlayer(id, type = "movie", title) {
  let entry = historyData.find(m => m.id === id && m.type === type);
  let startTime = entry && entry.progress ? `&progress=${Math.floor(entry.progress)}` : "";

  playerDiv.innerHTML = `
    <div class="player-wrapper">
      <div class="player-header">
        <h3>${title}</h3>
        <span class="player-type">${type === "tv" ? "TV Show" : "Movie"}</span>
      </div>
      <iframe 
        id="vidking-iframe"
        src="https://www.vidking.net/embed/${type}/${id}?color=66ccff&autoPlay=true${startTime}" 
        allowfullscreen
        allow="autoplay">
      </iframe>
      <div id="player-error" style="display:none; padding:20px; text-align:center; color:#ff6b6b;">
        <p>⚠️ This content is not available on Vidking</p>
        <p style="font-size:12px; opacity:0.7;">Try searching for another title</p>
      </div>
    </div>
  `;

  currentlyPlaying = { id, type, title };

  if (!entry) {
    historyData.push({ id, type, progress: 0, duration: 0 });
    saveHistory();
  }

  const iframe = document.getElementById('vidking-iframe');
  let checkCount = 0;
  
  const checkInterval = setInterval(() => {
    checkCount++;
    try {
      if (iframe && !iframe.src.includes(`/embed/${type}/${id}`)) {
        clearInterval(checkInterval);
        iframe.style.display = 'none';
        document.getElementById('player-error').style.display = 'block';
      }
    } catch (e) {
      // Cross-origin
    }
    
    if (checkCount > 10) clearInterval(checkInterval);
  }, 500);

  setTimeout(() => playerDiv.scrollIntoView({ behavior: 'smooth' }), 100);
}

// ---- Render Continue Watching ----
async function renderContinueWatching() {
  continueDiv.innerHTML = "";

  if (historyData.length === 0) {
    continueDiv.innerHTML = `<p class="placeholder">You haven't watched anything yet. Start watching to see it here!</p>`;
    return;
  }

  const watched = historyData.filter(item => item.progress > 0);
  
  if (watched.length === 0) {
    continueDiv.innerHTML = `<p class="placeholder">You haven't watched anything yet. Start watching to see it here!</p>`;
    return;
  }

  for (const item of watched) {
    try {
      const data = await apiCall(`/${item.type}/${item.id}`);
      if (data) {
        const card = createMovieCard(data, item.type);
        if (card) continueDiv.appendChild(card);
      }
    } catch (err) {
      console.error("Failed to fetch history item:", err);
    }
  }
}

// ---- Search Movies & TV ----
document.getElementById("searchBar").addEventListener("keyup", async (e) => {
  if (e.key !== "Enter") return;
  const query = e.target.value.trim();
  if (!query) {
    showError("Please enter a search term");
    return;
  }

  const data = await apiCall("/search/multi", { query });
  
  if (!data || !data.results) {
    playerDiv.innerHTML = "<p class='placeholder'>No results found</p>";
    return;
  }

  playerDiv.innerHTML = "<h2>Search Results</h2>";
  const row = document.createElement("div");
  row.className = "movie-row";

  data.results
    .filter(item => item.poster_path && (item.media_type === "movie" || item.media_type === "tv"))
    .forEach(item => {
      const card = createMovieCard(item, item.media_type);
      if (card) row.appendChild(card);
    });

  if (row.children.length === 0) {
    playerDiv.innerHTML = "<p class='placeholder'>No results found</p>";
  } else {
    playerDiv.appendChild(row);
  }
});

// ---- Listen for Vidking progress events ----
window.addEventListener("message", function(event) {
  try {
    let msg = event.data;
    if (typeof msg === "string") {
      try {
        msg = JSON.parse(msg);
      } catch {
        return;
      }
    }

    if (!msg || msg.type !== "PLAYER_EVENT" || !msg.data) return;

    const { currentTime, duration, id, mediaType } = msg.data;
    let entry = historyData.find(m => m.id === parseInt(id) && m.type === mediaType);

    if (!entry) {
      entry = { id: parseInt(id), type: mediaType, progress: 0, duration: 0 };
      historyData.push(entry);
    }

    entry.progress = currentTime;
    entry.duration = duration;
    saveHistory();
    
    if (msg.data.event === "ended") {
      renderContinueWatching();
    }
  } catch (err) {
    // Ignore
  }
});

// ---- Initial Load ----
loadHistory();
fetchMovies("/movie/now_playing", "newMovies", "movie");
fetchMovies("/movie/popular", "popularMovies", "movie");
fetchMovies("/movie/top_rated", "topRatedMovies", "movie");
fetchMovies("/tv/popular", "popularTV", "tv");
fetchMovies("/tv/top_rated", "topRatedTV", "tv");
renderContinueWatching();