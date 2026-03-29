// =====================
// WEATHER CODE MAP
// =====================
const WMO = {
  0:  ['Clear Sky',          '☀️'],
  1:  ['Mostly Clear',       '🌤'],
  2:  ['Partly Cloudy',      '⛅'],
  3:  ['Overcast',           '☁️'],
  45: ['Foggy',              '🌫'],
  48: ['Icy Fog',            '🌫'],
  51: ['Light Drizzle',      '🌦'],
  53: ['Drizzle',            '🌦'],
  55: ['Heavy Drizzle',      '🌧'],
  61: ['Light Rain',         '🌧'],
  63: ['Rain',               '🌧'],
  65: ['Heavy Rain',         '🌧'],
  71: ['Light Snow',         '🌨'],
  73: ['Snow',               '❄️'],
  75: ['Heavy Snow',         '🌨'],
  77: ['Snow Grains',        '🌨'],
  80: ['Showers',            '🌦'],
  81: ['Heavy Showers',      '🌧'],
  82: ['Violent Showers',    '⛈'],
  85: ['Snow Showers',       '🌨'],
  86: ['Heavy Snow Showers', '🌨'],
  95: ['Thunderstorm',       '⛈'],
  96: ['Thunderstorm+Hail',  '⛈'],
  99: ['Thunderstorm+Hail',  '⛈'],
};

function getGifForCode(code) { return null; } // unused

function getWMO(code) { return WMO[code] || ['Unknown', '🌡']; }

// =====================
// HELPERS
// =====================
function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], { weekday: 'short' });
}
function getFlag(cc) {
  if (!cc) return '🌍';
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

// =====================
// UNIT TOGGLE (°C / °F)
// =====================
let useFahrenheit = false;

function toF(c) { return Math.round(c * 9/5 + 32); }
function displayTemp(c) {
  return useFahrenheit ? toF(c) + '°F' : Math.round(c) + '°C';
}
function displayTempShort(c) {
  return useFahrenheit ? toF(c) + '°' : Math.round(c) + '°';
}

document.getElementById('unitToggle').addEventListener('click', () => {
  useFahrenheit = !useFahrenheit;
  const btn = document.getElementById('unitToggle');
  btn.textContent = useFahrenheit ? '°F' : '°C';
  if (lastWeatherData) renderWeather(lastWeatherData);
});

// =====================
// THEME TOGGLE
// =====================
const html = document.documentElement;
const themeBtn = document.getElementById('themeToggle');

let isDark = true;

function setTheme(dark, animate = false) {
  html.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeBtn.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('theme', dark ? 'dark' : 'light');

  const vidA = document.getElementById('vidA');
  const vidB = document.getElementById('vidB');

  // Figure out which is active and which is next
  const activeVid = vidA.classList.contains('vid-active') ? vidA : vidB;
  const nextVid   = vidA.classList.contains('vid-active') ? vidB : vidA;

  // Set the correct source on the next video
  nextVid.querySelector('source').src = dark ? 'night.mp4' : 'day.mp4';
  nextVid.load();
  nextVid.play();

  if (!animate) {
    // No animation on first load — just show it
    activeVid.classList.remove('vid-active');
    nextVid.classList.remove('vid-next');
    activeVid.querySelector('source').src = dark ? 'night.mp4' : 'day.mp4';
    activeVid.load();
    activeVid.play();
    activeVid.classList.add('vid-active');
    nextVid.classList.add('vid-next');
    return;
  }

  // Slide direction: going dark = slide right→left, going light = slide left→right
  const outClass = dark ? 'vid-slide-out-left'  : 'vid-slide-out-right';
  const inClass  = dark ? 'vid-slide-in-right'  : 'vid-slide-in-left';

  // Clear old animation classes
  activeVid.classList.remove('vid-slide-out-left','vid-slide-out-right','vid-slide-in-left','vid-slide-in-right');
  nextVid.classList.remove('vid-slide-out-left','vid-slide-out-right','vid-slide-in-left','vid-slide-in-right','vid-next');

  // Trigger animations
  activeVid.classList.add(outClass);
  nextVid.classList.add(inClass);

  // After animation ends, swap active/next classes
  nextVid.addEventListener('animationend', () => {
    activeVid.classList.remove('vid-active', outClass);
    activeVid.classList.add('vid-next');
    nextVid.classList.remove(inClass);
    nextVid.classList.add('vid-active');
  }, { once: true });
}

// Override theme toggle to animate
themeBtn.addEventListener('click', () => {
  isDark = html.getAttribute('data-theme') === 'light';
  setTheme(isDark, true);
});

// Load saved theme
setTheme(localStorage.getItem('theme') !== 'light', false);

// =====================
// FAVORITES
// =====================
function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}
function saveFavorites(favs) {
  localStorage.setItem('favorites', JSON.stringify(favs));
}

function addFavorite(city, lat, lon) {
  const favs = getFavorites();
  if (favs.find(f => f.city === city)) return;
  favs.push({ city, lat, lon });
  saveFavorites(favs);
  renderFavorites();
  updateSaveBtn(city);
}

function removeFavorite(city) {
  saveFavorites(getFavorites().filter(f => f.city !== city));
  renderFavorites();
  updateSaveBtn(currentCity);
}

function updateSaveBtn(city) {
  const btn = document.getElementById('saveBtn');
  const saved = getFavorites().find(f => f.city === city);
  btn.textContent = saved ? '★' : '☆';
  btn.classList.toggle('saved', !!saved);
  btn.title = saved ? 'Remove from favorites' : 'Save city';
}

function renderFavorites() {
  const dropdown = document.getElementById('favDropdown');
  const favs = getFavorites();

  if (favs.length === 0) {
    dropdown.innerHTML = '<div class="fav-empty">No saved cities yet</div>';
    return;
  }

  dropdown.innerHTML = favs.map(f => `
    <div class="fav-item" onclick="loadWeather(${f.lat}, ${f.lon}, '${f.city}')">
      <span class="fav-item-name">${f.city}</span>
      <button class="fav-remove" onclick="event.stopPropagation(); removeFavorite('${f.city}')">✕</button>
    </div>
  `).join('');
}

// Favorites dropdown toggle
const favBtn = document.getElementById('favBtn');
const favDropdown = document.getElementById('favDropdown');

favBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderFavorites();
  favDropdown.classList.toggle('open');
});

document.addEventListener('click', () => favDropdown.classList.remove('open'));
favDropdown.addEventListener('click', e => e.stopPropagation());

// Save button on hero card
let currentCity = '';
let currentLat = 0;
let currentLon = 0;

document.getElementById('saveBtn').addEventListener('click', () => {
  const favs = getFavorites();
  if (favs.find(f => f.city === currentCity)) {
    removeFavorite(currentCity);
  } else {
    addFavorite(currentCity, currentLat, currentLon);
  }
});

// =====================
// SEARCH / AUTOCOMPLETE
// =====================
const searchInput = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
let searchTimeout = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const val = searchInput.value.trim();
  if (val.length < 2) { suggestionsEl.style.display = 'none'; return; }
  searchTimeout = setTimeout(() => fetchSuggestions(val), 350);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') suggestionsEl.style.display = 'none';
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) suggestionsEl.style.display = 'none';
});

async function fetchSuggestions(query) {
  try {
    const res = await fetch(`/api/geocode?city=${encodeURIComponent(query)}`);
    if (!res.ok) return;
    const data = await res.json();

    suggestionsEl.innerHTML = '';
    data.forEach(place => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      const regionText = place.admin1 ? `${place.admin1}, ${place.country}` : place.country;
      item.innerHTML = `
        <span class="suggestion-flag">${getFlag(place.country_code)}</span>
        <div>
          <div class="suggestion-place">${place.name}</div>
          <div class="suggestion-region">${regionText}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        const label = place.admin1 ? `${place.name}, ${place.admin1}` : place.name;
        searchInput.value = place.name;
        suggestionsEl.style.display = 'none';
        loadWeather(place.lat, place.lon, label);
      });
      suggestionsEl.appendChild(item);
    });

    suggestionsEl.style.display = data.length ? 'block' : 'none';
  } catch (err) { console.error(err); }
}

// =====================
// LOAD WEATHER
// =====================
function showOnly(id) {
  ['loading','errorMsg','weatherDisplay'].forEach(s => {
    const el = document.getElementById(s);
    el.classList.remove('active');
    if (s === 'weatherDisplay') el.style.display = 'none';
  });
  document.getElementById('emptyState').style.display = 'none';

  if (id === 'loading') document.getElementById('loading').classList.add('active');
  else if (id === 'error') document.getElementById('errorMsg').classList.add('active');
  else if (id === 'weather') {
    document.getElementById('weatherDisplay').style.display = 'block';
    document.getElementById('weatherDisplay').classList.add('active');
  }
  else if (id === 'empty') document.getElementById('emptyState').style.display = 'block';
}

let lastWeatherData = null;

async function loadWeather(lat, lon, city) {
  showOnly('loading');
  currentCity = city;
  currentLat = lat;
  currentLon = lon;

  try {
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error('Failed to load weather');
    const data = await res.json();
    lastWeatherData = data;
    renderWeather(data);
    showOnly('weather');
    updateSaveBtn(city);
  } catch (err) {
    document.getElementById('errorText').textContent = err.message;
    showOnly('error');
  }
}

// =====================
// RENDER WEATHER
// =====================
function renderWeather(d) {
  setWeatherContext(d);
  const [desc, icon] = getWMO(d.current.weathercode);
  const nowHour = new Date().getHours();
  const hum = d.hourly.humidity[nowHour] ?? d.hourly.humidity[0];
  const prec = d.hourly.precipitation_prob[nowHour] ?? d.hourly.precipitation_prob[0];

  // Hero
  document.getElementById('cityName').textContent = d.city.toUpperCase();
  document.getElementById('localTime').textContent = new Date().toLocaleString([], {
    weekday: 'long', hour: '2-digit', minute: '2-digit',
  });
  document.getElementById('weatherDesc').textContent = desc;
  document.getElementById('heroIcon').textContent = icon;
  document.getElementById('heroTemp').textContent = displayTempShort(d.current.temp);
  document.getElementById('windSpeed').textContent = Math.round(d.current.windspeed);
  document.getElementById('feelsLike').textContent = 'WIND ' + Math.round(d.current.windspeed) + ' KM/H';
  document.getElementById('humidity').textContent = hum;
  document.getElementById('precipProb').textContent = prec;

  renderHourly(d, nowHour, icon);
  renderDaily(d);
  renderStats(d, hum, prec, desc);
  renderSun(d);
}

function renderHourly(d, nowHour, icon) {
  const scroll = document.getElementById('hourlyScroll');
  scroll.innerHTML = '';
  d.hourly.times.forEach((t, i) => {
    const hour = new Date(t).getHours();
    const el = document.createElement('div');
    el.className = 'hour-item' + (hour === nowHour ? ' active' : '');
    el.innerHTML = `
      <span>${hour === nowHour ? 'Now' : hour + ':00'}</span>
      <span class="hour-icon">${icon}</span>
      <span class="hour-temp">${displayTempShort(d.hourly.temps[i])}</span>
      <span class="hour-rain">${d.hourly.precipitation_prob[i]}% 💧</span>
    `;
    scroll.appendChild(el);
  });
}

function renderDaily(d) {
  const container = document.getElementById('dailyForecast');
  container.innerHTML = '';
  d.daily.times.forEach((t, i) => {
    const [, dIcon] = getWMO(d.daily.weathercodes[i]);
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <span class="day-name">${i === 0 ? 'Today' : fmtDay(t)}</span>
      <span class="day-icon">${dIcon}</span>
      <span class="day-range">
        <span class="day-hi">${displayTempShort(d.daily.max_temps[i])}</span>
        <span class="day-sep">/</span>
        <span class="day-lo">${displayTempShort(d.daily.min_temps[i])}</span>
      </span>
    `;
    container.appendChild(row);
  });
}

function renderStats(d, hum, prec, desc) {
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-item">
      <div class="s-label">Wind</div>
      <div class="s-val">${Math.round(d.current.windspeed)} <span class="s-unit">km/h</span></div>
    </div>
    <div class="stat-item">
      <div class="s-label">Humidity</div>
      <div class="s-val">${hum} <span class="s-unit">%</span></div>
    </div>
    <div class="stat-item">
      <div class="s-label">Rain Chance</div>
      <div class="s-val">${prec} <span class="s-unit">%</span></div>
    </div>
    <div class="stat-item">
      <div class="s-label">Condition</div>
      <div class="s-val s-val-text">${desc}</div>
    </div>
  `;
}

function renderSun(d) {
  document.getElementById('sunRow').innerHTML = `
    <div class="sun-item">
      <div class="sun-emoji">🌅</div>
      <div class="sun-time">${fmtTime(d.daily.sunrise[0])}</div>
      <div class="sun-label">Sunrise</div>
    </div>
    <div class="sun-divider"></div>
    <div class="sun-item">
      <div class="sun-emoji">🌇</div>
      <div class="sun-time">${fmtTime(d.daily.sunset[0])}</div>
      <div class="sun-label">Sunset</div>
    </div>
  `;
}

// =====================
// AI ASSISTANT
// =====================
let currentWeatherContext = null;
let conversationHistory = [];

function setWeatherContext(d) {
  const nowHour = new Date().getHours();
  const hum = d.hourly.humidity[nowHour] ?? d.hourly.humidity[0];
  const prec = d.hourly.precipitation_prob[nowHour] ?? d.hourly.precipitation_prob[0];
  const [desc] = getWMO(d.current.weathercode);

  currentWeatherContext = {
    city: d.city,
    temp: Math.round(d.current.temp),
    desc,
    windspeed: Math.round(d.current.windspeed),
    humidity: hum,
    precipProb: prec,
    highTemp: Math.round(d.daily.max_temps[0]),
    lowTemp: Math.round(d.daily.min_temps[0]),
    sunrise: fmtTime(d.daily.sunrise[0]),
    sunset: fmtTime(d.daily.sunset[0]),
  };

  conversationHistory = [];
  document.getElementById('aiMessages').innerHTML = `
    <div class="ai-bubble ai-bubble--bot">
      👋 I'm looking at the weather in ${d.city} right now. Ask me anything!
    </div>
  `;
}

function addMessage(text, type) {
  const messages = document.getElementById('aiMessages');
  const bubble = document.createElement('div');
  bubble.className = `ai-bubble ai-bubble--${type}`;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function sendQuestion() {
  const input = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSend');
  const question = input.value.trim();
  if (!question) return;

  if (!currentWeatherContext) {
    addMessage('Please search for a city first!', 'bot');
    return;
  }

  addMessage(question, 'user');
  input.value = '';
  sendBtn.disabled = true;
  const thinking = addMessage('Thinking...', 'thinking');

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, weather: currentWeatherContext, history: conversationHistory }),
    });

    const data = await res.json();
    thinking.remove();

    if (data.error) {
      addMessage('Sorry, something went wrong: ' + data.error, 'bot');
    } else {
      conversationHistory.push({ role: 'user', content: question });
      conversationHistory.push({ role: 'assistant', content: data.answer });
      if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);
      addMessage(data.answer, 'bot');
    }
  } catch (err) {
    thinking.remove();
    addMessage('Could not connect to AI. Make sure the server is running.', 'bot');
  }

  sendBtn.disabled = false;
  input.focus();
}

function askQuick(question) {
  document.getElementById('aiInput').value = question;
  sendQuestion();
}

document.getElementById('aiInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendQuestion();
});

// =====================
// INIT
// =====================
showOnly('empty');
