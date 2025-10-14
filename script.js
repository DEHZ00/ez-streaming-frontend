// ⚙️ CONFIGURATION
const BACKEND_URL = "https://ez-streaming-api.vercel.app";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

// DOM Elements
const playerDiv = document.getElementById("player");
const continueDiv = document.getElementById("continueWatching");
const loadingSpinner = document.getElementById("loadingSpinner");
const detailsModal = document.getElementById("detailsModal");
const detailsBody = document.getElementById("detailsBody");
const closeBtn = document.querySelector(".close-btn");

// State
let historyData = [];
let watchlistData = [];
let currentlyPlaying = null;
let isLoading = false;
let currentPage = "home";

// ---- Local Storage Management ----
function loadHistory() {
  historyData = JSON.parse(localStorage.getItem("history") || "[]");
}

function loadWatchlist() {
  watchlistData = JSON.parse(localStorage.getItem("watchlist") || "[]");
}

function saveHistory() {
  localStorage.setItem("history", JSON.stringify(historyData));
}

function saveWatchlist() {
  localStorage.setItem("watchlist", JSON.stringify(watchlistData));
}

// ---- UI Helpers ----
function showLoading(show = true) {
  isLoading = show;
  if (loadingSpinner) {
    loadingSpinner.style.display = show ? "flex" : "none";
  }
}

function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 4000);
}

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(page + "Page").classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(page + "Btn").classList.add("active");
  playerDiv.innerHTML = "";
  window.scrollTo(0, 0);
}

// ---- API Call Helper ----
async function apiCall(endpoint, params = {}) {
  try {
    showLoading(true);
    const queryString = new URLSearchParams(params).toString();
    const url = `${BACKEND_URL}/api/tmdb${endpoint}${queryString ? "?" + queryString : ""}`;
    
    console.log("API Call:", url);
    
    const res = await fetch(url);
    console.log("Response status:", res.status);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    console.log("Response data:", data);
    
    showLoading(false);
    return data;
  } catch (err) {
    console.error("API Error:", err);
    showLoading(false);
    showError("Failed to load data. Check console for details.");
    return null;
  }
}

// ---- Watchlist Management ----
function toggleWatchlist(id, type, movie) {
  let index = watchlistData.findIndex(m => m.id === id && m.type === type);
  
  if (index > -1) {
    watchlistData.splice(index, 1);
    showError("Removed from watchlist");
  } else {
    watchlistData.push({ 
      id, 
      type, 
      title: movie.title || movie.name,
      poster_path: movie.poster_path,
      addedAt: new Date().toISOString()
    });
    showError("Added to watchlist ✓");
  }
  
  saveWatchlist();
}

function isInWatchlist(id, type) {
  return watchlistData.some(m => m.id === id && m.type === type);
}

// ---- Movie/TV Card Creation ----
function createMovieCard(movie, type = "movie") {
  const card = document.createElement("div");
  card.className = "movie-card";

  if (!movie.poster_path) return null;

  let entry = historyData.find(m => m.id === movie.id && m.type === type);
  let percent = entry && entry.duration ? (entry.progress / entry.duration) * 100 : 0;
  let inWatchlist = isInWatchlist(movie.id, type);

  const title = movie.title || movie.name || "Unknown";
  
  card.innerHTML = `
    <div class="card-image-wrapper">
      <img src="${IMG_BASE + movie.poster_path}" alt="${title}" loading="lazy">
      ${percent > 0 ? `<div class="progress-bar" style="width:${percent}%"></div>` : ""}
      <div class="card-overlay">
        <button class="play-btn">▶ Play</button>
        <div class="card-buttons">
          <button class="watchlist-btn" title="Add to watchlist">${inWatchlist ? "★" : "☆"}</button>
          <button class="info-btn" title="More info">ⓘ</button>
        </div>
      </div>
    </div>
    <p>${title}</p>
  `;

  card.querySelector(".play-btn").onclick = (e) => {
    e.stopPropagation();
    loadPlayer(movie.id, type, title);
  };

  card.querySelector(".watchlist-btn").onclick = (e) => {
    e.stopPropagation();
    toggleWatchlist(movie.id, type, movie);
    const btn = e.target;
    btn.textContent = isInWatchlist(movie.id, type) ? "★" : "☆";
  };

  card.querySelector(".info-btn").onclick = (e) => {
    e.stopPropagation();
    showMovieDetails(movie, type);
  };

  return card;
}

// ---- Show Movie Details in Modal ----
async function showMovieDetails(movie, type) {
  const data = await apiCall(`/${type}/${movie.id}`);
  if (!data) return;

  const genres = data.genres?.map(g => g.name).join(", ") || "N/A";
  const rating = data.vote_average?.toFixed(1) || "N/A";
  const overview = data.overview || "No description available";
  const releaseDate = data.release_date || data.first_air_date || "N/A";
  const runtime = data.runtime ? `${data.runtime} min` : (data.episode_run_time?.[0] + " min" || "N/A");

  detailsBody.innerHTML = `
    <div class="details-card">
      <img src="${IMG_BASE + movie.poster_path}" alt="${movie.title || movie.name}" class="details-poster">
      <div class="details-info">
        <h2>${movie.title || movie.name}</h2>
        <div class="details-meta">
          <span class="rating">⭐ ${rating}/10</span>
          <span class="release">${releaseDate}</span>
          <span class="runtime">${runtime}</span>
        </div>
        <p class="genres"><strong>Genres:</strong> ${genres}</p>
        <p class="overview">${overview}</p>
      </div>
    </div>
  `;
  
  detailsModal.style.display = "block";
}

// Close modal
closeBtn.onclick = () => {
  detailsModal.style.display = "none";
};

window.onclick = (e) => {
  if (e.target === detailsModal) {
    detailsModal.style.display = "none";
  }
};

// ---- Load Vidking Player ----
function loadPlayer(id, type = "movie", title) {
  // For TV shows, default to Season 1, Episode 1 with full features
  const vidkingUrl = type === "tv" 
    ? `https://www.vidking.net/embed/${type}/${id}/1/1?color=66ccff&autoPlay=true&nextEpisode=true&episodeSelector=true`
    : `https://www.vidking.net/embed/${type}/${id}?color=66ccff&autoPlay=true`;

  playerDiv.innerHTML = `
    <div class="player-wrapper">
      <div class="player-header">
        <h3>${title}</h3>
        <span class="player-type">${type === "tv" ? "TV Show" : "Movie"}</span>
      </div>
      <iframe 
        id="vidking-iframe"
        src="${vidkingUrl}" 
        allowfullscreen
        allow="autoplay"
        referrerpolicy="no-referrer">
      </iframe>
      <div id="player-error" style="display:none; padding:20px; text-align:center; color:#ff6b6b;">
        <p>⚠️ This content is not available on Vidking</p>
        <p style="font-size:12px; opacity:0.7;">Try searching for another title</p>
      </div>
    </div>
  `;

  currentlyPlaying = { id, type, title };

  let entry = historyData.find(m => m.id === id && m.type === type);
  if (!entry) {
    historyData.push({ id, type, progress: 0, duration: 0 });
    saveHistory();
  }

  // Error detection
  const iframe = document.getElementById('vidking-iframe');
  let checkCount = 0;
  
  const checkInterval = setInterval(() => {
    checkCount++;
    try {
      const expectedPath = type === "tv" ? `/embed/${type}/${id}/1/1` : `/embed/${type}/${id}`;
      if (iframe && !iframe.src.includes(expectedPath)) {
        clearInterval(checkInterval);
        iframe.style.display = 'none';
        document.getElementById('player-error').style.display = 'block';
      }
    } catch (e) {
      // Cross-origin restriction
    }
    
    if (checkCount > 10) clearInterval(checkInterval);
  }, 500);

  setTimeout(() => playerDiv.scrollIntoView({ behavior: 'smooth' }), 100);
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

// ---- Render Continue Watching ----
async function renderContinueWatching() {
  continueDiv.innerHTML = "";

  if (historyData.length === 0) {
    continueDiv.innerHTML = `<p class="placeholder">You haven't watched anything yet. Start watching to see it here!</p>`;
    return;
  }

  const watched = historyData.filter(item => item.progress > 0).sort((a, b) => b.addedAt - a.addedAt);
  
  if (watched.length === 0) {
    continueDiv.innerHTML = `<p class="placeholder">You haven't watched anything yet. Start watching to see it here!</p>`;
    return;
  }

  for (const item of watched.slice(0, 20)) {
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

// ---- Render Watchlist Page ----
async function renderWatchlist() {
  const container = document.getElementById("watchlistContent");
  container.innerHTML = "";

  if (watchlistData.length === 0) {
    container.innerHTML = `<p class="placeholder">Your watchlist is empty. Add movies or shows to watch later!</p>`;
    return;
  }

  for (const item of watchlistData) {
    try {
      const data = await apiCall(`/${item.type}/${item.id}`);
      if (data) {
        const card = createMovieCard(data, item.type);
        if (card) container.appendChild(card);
      }
    } catch (err) {
      console.error("Failed to fetch watchlist item:", err);
    }
  }
}

// ---- Render Trending Page ----
async function renderTrending() {
  const container = document.getElementById("trendingContent");
  
  const movieData = await apiCall("/trending/movie/week");
  const tvData = await apiCall("/trending/tv/week");

  container.innerHTML = "";

  if (movieData && movieData.results) {
    movieData.results
      .filter(item => item.poster_path)
      .slice(0, 10)
      .forEach(item => {
        const card = createMovieCard(item, "movie");
        if (card) container.appendChild(card);
      });
  }

  if (tvData && tvData.results) {
    tvData.results
      .filter(item => item.poster_path)
      .slice(0, 10)
      .forEach(item => {
        const card = createMovieCard(item, "tv");
        if (card) container.appendChild(card);
      });
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

  console.log("Searching for:", query);
  const data = await apiCall("/search/multi", { query });
  
  console.log("Search results:", data);
  
  if (!data || !data.results) {
    console.warn("No results in response");
    playerDiv.innerHTML = "<p class='placeholder'>No results found</p>";
    return;
  }

  console.log("Total results:", data.results.length);
  
  // Create search results container
  playerDiv.innerHTML = "";
  const searchSection = document.createElement("section");
  searchSection.innerHTML = "<h2>Search Results</h2>";
  
  const row = document.createElement("div");
  row.className = "movie-row";

  const filtered = data.results.filter(item => item.poster_path && (item.media_type === "movie" || item.media_type === "tv"));
  console.log("Filtered results:", filtered.length);

  filtered.forEach(item => {
    const card = createMovieCard(item, item.media_type);
    if (card) row.appendChild(card);
  });

  if (row.children.length === 0) {
    searchSection.innerHTML += "<p class='placeholder'>No results with posters found</p>";
  } else {
    searchSection.appendChild(row);
  }

  playerDiv.appendChild(searchSection);
  playerDiv.scrollIntoView({ behavior: 'smooth' });
});

// ---- Navigation ----
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    switchPage(page);
    
    if (page === "watchlist") renderWatchlist();
    if (page === "trending") renderTrending();
  });
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
      entry = { id: parseInt(id), type: mediaType, progress: 0, duration: 0, addedAt: Date.now() };
      historyData.push(entry);
    }

    entry.progress = currentTime;
    entry.duration = duration;
    entry.addedAt = Date.now();
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
loadWatchlist();
fetchMovies("/movie/now_playing", "newMovies", "movie");
fetchMovies("/movie/popular", "popularMovies", "movie");
fetchMovies("/movie/top_rated", "topRatedMovies", "movie");
fetchMovies("/tv/popular", "popularTV", "tv");
fetchMovies("/tv/top_rated", "topRatedTV", "tv");
renderContinueWatching();