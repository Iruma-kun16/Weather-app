const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// GET /api/weather
app.get('/api/weather', async (req, res) => {
  const { lat, lon, city } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

  const cacheKey = `weather_${lat}_${lon}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,precipitation_probability,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API failed');
    const data = await response.json();

    const result = {
      city: city || 'Unknown',
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      current: {
        temp: data.current_weather.temperature,
        windspeed: data.current_weather.windspeed,
        weathercode: data.current_weather.weathercode,
        is_day: data.current_weather.is_day,
        time: data.current_weather.time,
      },
      hourly: {
        times: data.hourly.time.slice(0, 24),
        temps: data.hourly.temperature_2m.slice(0, 24),
        humidity: data.hourly.relativehumidity_2m.slice(0, 24),
        windspeed: data.hourly.windspeed_10m.slice(0, 24),
        precipitation_prob: data.hourly.precipitation_probability.slice(0, 24),
      },
      daily: {
        times: data.daily.time,
        max_temps: data.daily.temperature_2m_max,
        min_temps: data.daily.temperature_2m_min,
        weathercodes: data.daily.weathercode,
        sunrise: data.daily.sunrise,
        sunset: data.daily.sunset,
      },
      timezone: data.timezone,
    };

    setCache(cacheKey, result);
    res.json({ ...result, fromCache: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// GET /api/geocode
app.get('/api/geocode', async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city param required' });

  const cacheKey = `geo_${city.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) return res.status(404).json({ error: 'City not found' });

    const results = data.results.map(r => ({
      name: r.name,
      country: r.country,
      country_code: r.country_code,
      lat: r.latitude,
      lon: r.longitude,
      admin1: r.admin1 || '',
    }));

    setCache(cacheKey, results);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// POST /api/ask — AI weather assistant via Groq
app.post('/api/ask', async (req, res) => {
  const { question, weather, history } = req.body;
  if (!question || !weather) return res.status(400).json({ error: 'question and weather are required' });

  const systemPrompt = `You are a friendly weather assistant named Skies.
Current weather data:
- City: ${weather.city}
- Temperature: ${weather.temp}°C
- Condition: ${weather.desc}
- Wind speed: ${weather.windspeed} km/h
- Humidity: ${weather.humidity}%
- Rain chance: ${weather.precipProb}%

Give short 2-3 sentence practical advice. Remember the conversation context when answering follow-up questions.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []),
    { role: 'user', content: question },
  ];

  try {
    const url = `https://api.groq.com/openai/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Groq API error' });
    }

    const answer = data.choices[0].message.content;
    res.json({ answer });

  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
});