/* =========================================
   AETHER - Main Application Script
   ========================================= */

const API_KEY = "e1b377262964001801e9a17b2163d429";
const BASE_URL = "https://api.openweathermap.org/data/2.5";

class WeatherApp {
    constructor() {
        this.state = {
            city: 'Seoul',
            unit: 'C',
            theme: 'light',
            favorites: JSON.parse(localStorage.getItem('aether_favorites')) || [],
            currentData: null,
            chartInstance: null,
            mapInstance: null
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.fetchWeather(this.state.city);
        this.initMap();
    }

    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                this.switchTab(target);
            });
        });

        // Search
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const city = e.target.value.trim();
                if (city) this.fetchWeather(city);
            }
        });

        // Toggles
        document.getElementById('btn-unit').addEventListener('click', () => this.toggleUnit());
        document.getElementById('btn-theme').addEventListener('click', () => this.toggleTheme());
        document.getElementById('btn-fav-add').addEventListener('click', () => this.toggleFavorite());
    }

    switchTab(tabName) {
        // Update Nav
        document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
        document.querySelector(`.nav-item[data-tab="${tabName}"]`).classList.add('active');

        // Update Content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        // Trigger specific tab actions
        if (tabName === 'skyview') {
            this.updateSkyview();
        } else if (tabName === 'favorites') {
            this.renderFavorites();
        } else if (tabName === 'today' && this.state.mapInstance) {
            setTimeout(() => this.state.mapInstance.invalidateSize(), 100);
        }
    }

    // --- API ---
    async fetchWeather(city) {
        try {
            document.getElementById('city-name').textContent = "Loading...";

            const res = await fetch(`${BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`);
            if (!res.ok) throw new Error('API Error');

            const data = await res.json();
            const forecastRes = await fetch(`${BASE_URL}/forecast?lat=${data.coord.lat}&lon=${data.coord.lon}&units=metric&appid=${API_KEY}`);
            const forecastData = await forecastRes.json();

            this.processData(data, forecastData);
        } catch (err) {
            console.warn("API Error, using mock data:", err);
            this.useMockData(city);
        }
    }

    useMockData(city) {
        const now = Math.floor(Date.now() / 1000);
        const mockWeather = {
            name: city,
            weather: [{ icon: '01d', main: 'Clear', id: 800 }],
            main: { temp: 22, feels_like: 24, humidity: 45, pressure: 1012 },
            wind: { speed: 3.5, deg: 180 },
            coord: { lat: 37.56, lon: 126.97 },
            sys: { sunrise: now - 14400, sunset: now + 14400 }
        };

        const mockForecast = { list: [] };
        for (let i = 0; i < 40; i++) {
            mockForecast.list.push({
                dt: now + (i * 10800),
                main: { temp: 20 + Math.random() * 5 },
                weather: [{ icon: '02d', id: 801 }],
                pop: Math.random() * 0.3
            });
        }

        this.processData(mockWeather, mockForecast);
    }

    processData(weather, forecast) {
        const aqi = Math.floor(Math.random() * 5) + 1;
        this.state.currentData = { weather, forecast, aqi };
        this.state.city = weather.name;

        this.renderToday();
        this.updateBackground(weather.weather[0].id);
        this.updateFavoriteBtn();
        if (this.state.mapInstance) {
            this.state.mapInstance.setView([weather.coord.lat, weather.coord.lon], 10);
        }
        this.renderCityLists();
    }

    // --- Render Today ---
    renderToday() {
        const { weather, forecast, aqi } = this.state.currentData;

        // Header
        document.getElementById('city-name').textContent = weather.name;

        // Update Date & Time
        this.updateDateTime(weather);

        document.getElementById('current-icon').src = `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`;
        document.getElementById('current-temp').textContent = `${Math.round(this.getTemp(weather.main.temp))}°`;

        // Current Weather Infographics
        this.updateCurrentInfographics(weather, aqi);

        // Hourly (6 items)
        this.renderHourly(forecast.list);

        // Trend Chart
        this.renderTrendChart(forecast.list);

        // Forecast List
        this.renderForecastList(forecast.list);

        // Lifestyle
        this.renderLifestyle(weather);

        // Outfit
        this.renderOutfit(weather);
    }

    updateDateTime(weather) {
        // Get timezone offset in seconds
        const timezoneOffset = weather.timezone || 0;

        const updateClock = () => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const cityTime = new Date(utc + (timezoneOffset * 1000));

            // Format date
            const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
            const dateStr = cityTime.toLocaleDateString('en-US', dateOptions);

            // Format time
            const hours = cityTime.getHours().toString().padStart(2, '0');
            const minutes = cityTime.getMinutes().toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;

            document.getElementById('current-date').textContent = dateStr;
            document.getElementById('current-time').textContent = timeStr;
        };

        updateClock();
        // Update every minute
        if (this.clockInterval) clearInterval(this.clockInterval);
        this.clockInterval = setInterval(updateClock, 60000);
    }

    updateCurrentInfographics(weather, aqi) {
        const feels = this.getTemp(weather.main.feels_like);
        const temp = this.getTemp(weather.main.temp);

        // Feels Like - Temperature Bar
        document.getElementById('val-feels').textContent = `${Math.round(feels)}°`;
        const feelsBar = (feels / 40) * 100; // Assuming 0-40°C range
        document.getElementById('feels-bar').style.width = `${Math.min(100, Math.max(0, feelsBar))}%`;

        // Wind - Mini Compass
        document.getElementById('val-wind').textContent = `${weather.wind.speed} m/s`;
        document.getElementById('wind-arrow-mini').style.transform = `rotate(${weather.wind.deg}deg)`;

        // Humidity - Water Drop
        document.getElementById('val-humidity').textContent = `${weather.main.humidity}%`;
        document.getElementById('humidity-fill').style.height = `${weather.main.humidity}%`;

        // AQI - Color Bar
        document.getElementById('val-aqi').textContent = aqi;
        const aqiBar = document.getElementById('aqi-bar');
        aqiBar.className = 'aqi-bar';
        if (aqi <= 1) aqiBar.classList.add('good');
        else if (aqi <= 2) aqiBar.classList.add('moderate');
        else if (aqi <= 3) aqiBar.classList.add('unhealthy');
        else if (aqi <= 4) aqiBar.classList.add('very-unhealthy');
        else aqiBar.classList.add('hazardous');
    }

    renderHourly(list) {
        const container = document.getElementById('hourly-scroll');
        container.innerHTML = '';

        // Show 6 items
        list.slice(0, 6).forEach(item => {
            const date = new Date(item.dt * 1000);
            const hour = date.getHours();
            const pop = Math.round((item.pop || 0) * 100);

            const el = document.createElement('div');
            el.className = 'hourly-card';
            el.innerHTML = `
                <span class="hourly-time">${hour}:00</span>
                <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" class="hourly-icon">
                <span class="hourly-temp">${Math.round(this.getTemp(item.main.temp))}°</span>
                <div class="precip-drop">
                    <div class="precip-fill" style="height: ${pop}%"></div>
                </div>
                <span class="precip-text">${pop}%</span>
            `;
            container.appendChild(el);
        });
    }

    renderTrendChart(list) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        const labels = [];
        const dataPoints = [];

        const daily = list.filter((_, i) => i % 8 === 4).slice(0, 5);
        daily.forEach(item => {
            const d = new Date(item.dt * 1000);
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            dataPoints.push(this.getTemp(item.main.temp));
        });

        if (this.state.chartInstance) this.state.chartInstance.destroy();

        if (typeof Chart !== 'undefined') {
            this.state.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Temp',
                        data: dataPoints,
                        borderColor: '#3498db',
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { display: false }, x: { grid: { display: false } } }
                }
            });
        }
    }

    renderForecastList(list) {
        const container = document.getElementById('daily-list');
        container.innerHTML = '';

        const daily = list.filter((_, i) => i % 8 === 4).slice(0, 5);
        daily.forEach(item => {
            const d = new Date(item.dt * 1000);
            const pop = Math.round((item.pop || 0) * 100);

            const el = document.createElement('div');
            el.className = 'daily-row';
            el.innerHTML = `
                <span class="daily-day">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" class="daily-weather-icon">
                <span class="daily-temp">${Math.round(this.getTemp(item.main.temp))}°</span>
                <div class="daily-precip">
                    <span>💧</span>
                    <span>${pop}%</span>
                </div>
            `;
            container.appendChild(el);
        });
    }

    renderLifestyle(data) {
        // Humidity
        document.getElementById('life-humidity').textContent = `${data.main.humidity}%`;
        document.getElementById('gauge-humidity').style.height = `${data.main.humidity}%`;

        // Wind
        document.getElementById('life-wind-speed').textContent = `${data.wind.speed} m/s`;
        document.getElementById('compass-arrow').style.transform = `rotate(${data.wind.deg}deg)`;

        // UV (Mock)
        const uv = Math.floor(Math.random() * 11);
        document.getElementById('life-uv').textContent = `UV: ${uv}`;
        const uvDeg = -180 + (uv / 11) * 180;
        document.getElementById('gauge-uv').style.transform = `rotate(${uvDeg}deg)`;

        // Pressure
        document.getElementById('life-pressure').textContent = `${data.main.pressure} hPa`;
        const pPct = Math.min(100, Math.max(0, (data.main.pressure - 950) / 100 * 100));
        document.getElementById('bar-pressure').style.width = `${pPct}%`;
    }

    renderOutfit(data) {
        const temp = this.getTemp(data.main.temp);
        let t = this.state.unit === 'F' ? (temp - 32) * 5 / 9 : temp;

        let icon = '👕';
        let text = "Comfortable weather.";
        if (t < 10) { icon = '🧥'; text = "Wear a warm coat."; }
        else if (t > 25) { icon = '🎽'; text = "Stay cool and hydrated."; }

        document.getElementById('outfit-icon').textContent = icon;
        document.getElementById('outfit-text').textContent = text;
    }

    renderCityLists() {
        const globals = ['New York', 'London', 'Paris', 'Tokyo'];
        const domestic = ['Seoul', 'Busan', 'Jeju', 'Incheon'];

        this.fillCityList(document.getElementById('list-global'), globals);
        this.fillCityList(document.getElementById('list-domestic'), domestic);
    }

    async fillCityList(container, cities) {
        container.innerHTML = '';
        for (let city of cities) {
            let data;
            try {
                const res = await fetch(`${BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`);
                if (!res.ok) throw new Error("API Fail");
                data = await res.json();
            } catch (e) {
                data = {
                    weather: [{ icon: '01d' }],
                    main: { temp: 20 + Math.random() * 10 }
                };
            }

            const el = document.createElement('div');
            el.className = 'city-row';
            el.innerHTML = `
                <span>${city}</span>
                <div class="city-info">
                    <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}.png" class="city-weather-icon">
                    <span class="city-temp">${Math.round(this.getTemp(data.main.temp))}°</span>
                </div>
            `;
            container.appendChild(el);
        }
    }

    // --- Map ---
    initMap() {
        if (typeof L === 'undefined') return;
        this.state.mapInstance = L.map('map-container').setView([37.5665, 126.9780], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.state.mapInstance);
    }

    // --- Skyview ---
    updateSkyview() {
        if (!this.state.currentData) return;

        const { weather } = this.state.currentData;
        this.animateSun(weather.sys.sunrise, weather.sys.sunset);
        this.updateMoon();
        this.showPlanets();
        this.animateConstellation();
        this.animateMeteors();
    }

    animateSun(sunrise, sunset) {
        const now = Math.floor(Date.now() / 1000);
        const totalDaylight = sunset - sunrise;
        const elapsed = now - sunrise;
        const progress = Math.min(1, Math.max(0, elapsed / totalDaylight));

        // Move sun along arc (180 degrees)
        const angle = progress * 180;
        const radians = (angle - 90) * (Math.PI / 180);
        const radius = 120;
        const x = radius * Math.cos(radians);
        const y = radius * Math.sin(radians);

        const sunEl = document.getElementById('sun-body');
        if (sunEl) {
            sunEl.style.left = `calc(50% + ${x}px)`;
            sunEl.style.bottom = `${20 + Math.abs(y)}px`;
        }

        // Update times
        document.getElementById('time-sunrise').textContent = new Date(sunrise * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('time-sunset').textContent = new Date(sunset * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    updateMoon() {
        // Simple moon phase calculation
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        // Approximate moon phase
        const c = (year - 1900) * 12.3685;
        const e = (month + c - 4) % 12;
        const jd = c + e + day;
        const phase = ((jd + 4.867) / 29.53059) % 1;

        const illumination = Math.round(Math.abs(0.5 - phase) * 200);
        let phaseName = '';
        let daysToNext = 0;

        if (phase < 0.03 || phase > 0.97) {
            phaseName = 'New Moon 🌑';
            daysToNext = Math.round((1 - phase) * 29.53);
        } else if (phase < 0.22) {
            phaseName = 'Waxing Crescent 🌒';
            daysToNext = Math.round((0.5 - phase) * 29.53);
        } else if (phase < 0.28) {
            phaseName = 'First Quarter 🌓';
            daysToNext = Math.round((0.5 - phase) * 29.53);
        } else if (phase < 0.47) {
            phaseName = 'Waxing Gibbous 🌔';
            daysToNext = Math.round((0.5 - phase) * 29.53);
        } else if (phase < 0.53) {
            phaseName = 'Full Moon 🌕';
            daysToNext = Math.round((1 - phase) * 29.53);
        } else if (phase < 0.72) {
            phaseName = 'Waning Gibbous 🌖';
            daysToNext = Math.round((1 - phase) * 29.53);
        } else if (phase < 0.78) {
            phaseName = 'Last Quarter 🌗';
            daysToNext = Math.round((1 - phase) * 29.53);
        } else {
            phaseName = 'Waning Crescent 🌘';
            daysToNext = Math.round((1 - phase) * 29.53);
        }

        document.getElementById('moon-phase-name').textContent = phaseName;
        document.getElementById('moon-illumination').textContent = `${illumination}% Illuminated`;
        document.getElementById('moon-days-info').textContent = `Next phase in ${daysToNext} days`;

        // Update visual
        const moonVisual = document.getElementById('moon-visual');
        if (moonVisual) {
            moonVisual.style.background = `radial-gradient(circle at ${50 + phase * 50}% 50%, #f4f4f4 30%, #666 100%)`;
        }
    }

    showPlanets() {
        const planets = [
            { name: 'Mercury', img: 'assets/planet/mercury.png' },
            { name: 'Venus', img: 'assets/planet/venus.png' },
            { name: 'Mars', img: 'assets/planet/mars.png' },
            { name: 'Jupiter', img: 'assets/planet/jupiter.png' },
            { name: 'Saturn', img: 'assets/planet/saturn.png' }
        ];

        const container = document.getElementById('planet-list');
        container.innerHTML = '';

        planets.forEach(planet => {
            const el = document.createElement('div');
            el.className = 'planet-item';
            el.innerHTML = `
                <img src="${planet.img}" class="planet-img" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2218%22 fill=%22%23666%22/%3E%3C/svg%3E'">
                <div>${planet.name}</div>
            `;
            container.appendChild(el);
        });
    }

    animateConstellation() {
        const canvas = document.getElementById('constellationCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const stars = [
            { x: 50, y: 150, tx: 50, ty: 150 },
            { x: 80, y: 130, tx: 80, ty: 130 },
            { x: 120, y: 140, tx: 120, ty: 140 },
            { x: 150, y: 100, tx: 150, ty: 100 },
            { x: 180, y: 80, tx: 180, ty: 80 },
            { x: 220, y: 90, tx: 220, ty: 90 }
        ];

        // Randomize initial positions
        stars.forEach(s => {
            s.x = Math.random() * 300;
            s.y = Math.random() * 200;
        });

        let progress = 0;

        const animate = () => {
            ctx.clearRect(0, 0, 300, 200);

            // Draw Stars
            stars.forEach(s => {
                s.x += (s.tx - s.x) * 0.05;
                s.y += (s.ty - s.y) * 0.05;

                ctx.beginPath();
                ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#f1c40f';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#f1c40f';
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            // Draw Lines when stars are close to target
            if (progress > 50) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                stars.forEach((s, i) => {
                    if (i === 0) ctx.moveTo(s.x, s.y);
                    else ctx.lineTo(s.x, s.y);
                });
                ctx.stroke();
            }

            progress++;
            if (progress < 200) requestAnimationFrame(animate);
        };

        animate();
    }

    animateMeteors() {
        const canvas = document.getElementById('meteorCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const meteors = [];

        for (let i = 0; i < 5; i++) {
            meteors.push({
                x: Math.random() * 300,
                y: -20,
                speed: 2 + Math.random() * 3,
                length: 20 + Math.random() * 30
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, 300, 150);

            meteors.forEach((m, i) => {
                m.y += m.speed;
                m.x += m.speed * 0.5;

                if (m.y > 170) {
                    m.y = -20;
                    m.x = Math.random() * 300;
                }

                const gradient = ctx.createLinearGradient(m.x, m.y, m.x - m.length, m.y - m.length);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x - m.length, m.y - m.length);
                ctx.stroke();
            });

            requestAnimationFrame(animate);
        };

        animate();

        // Meteor shower info
        const info = document.getElementById('meteor-info');
        if (info) {
            info.innerHTML = `
                <div style="padding: 10px; font-size: 0.9rem;">
                    <p><strong>Perseids:</strong> August 12-13, up to 100 meteors/hour</p>
                    <p><strong>Geminids:</strong> December 13-14, up to 120 meteors/hour</p>
                </div>
            `;
        }
    }

    // --- Background ---
    updateBackground(weatherCode) {
        const bgContainer = document.querySelector('.background-container');
        if (!bgContainer) return;

        bgContainer.className = 'background-container';

        const isNight = new Date().getHours() > 18 || new Date().getHours() < 6;

        if (isNight) {
            bgContainer.classList.add('clear');
            // Add stars for night
        } else if (weatherCode === 800) {
            bgContainer.classList.add('clear');
        } else if (weatherCode >= 801 && weatherCode < 900) {
            bgContainer.classList.add('clouds');
        } else if (weatherCode >= 500 && weatherCode < 600) {
            bgContainer.classList.add('rain');
            this.addRainEffect();
        } else if (weatherCode >= 600 && weatherCode < 700) {
            bgContainer.classList.add('snow');
            this.addSnowEffect();
        } else {
            bgContainer.classList.add('clouds');
        }
    }

    addRainEffect() {
        const bgContainer = document.querySelector('.background-container');
        bgContainer.innerHTML = '';

        for (let i = 0; i < 50; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = `${Math.random() * 100}%`;
            drop.style.animationDuration = `${0.5 + Math.random() * 0.3}s`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            bgContainer.appendChild(drop);
        }
    }

    addSnowEffect() {
        const bgContainer = document.querySelector('.background-container');
        bgContainer.innerHTML = '';

        for (let i = 0; i < 30; i++) {
            const flake = document.createElement('div');
            flake.className = 'snow-flake';
            flake.style.left = `${Math.random() * 100}%`;
            flake.style.width = `${2 + Math.random() * 4}px`;
            flake.style.height = flake.style.width;
            flake.style.animationDuration = `${3 + Math.random() * 2}s`;
            flake.style.animationDelay = `${Math.random() * 5}s`;
            bgContainer.appendChild(flake);
        }
    }

    // --- Favorites ---
    toggleFavorite() {
        const city = this.state.city;
        const index = this.state.favorites.indexOf(city);

        if (index === -1) {
            this.state.favorites.push(city);
        } else {
            this.state.favorites.splice(index, 1);
        }

        localStorage.setItem('aether_favorites', JSON.stringify(this.state.favorites));
        this.updateFavoriteBtn();
        this.renderFavorites();
    }

    updateFavoriteBtn() {
        const btn = document.getElementById('btn-fav-add');
        const isFav = this.state.favorites.includes(this.state.city);
        btn.classList.toggle('active', isFav);
        btn.textContent = isFav ? '★' : '☆';
    }

    renderFavorites() {
        const container = document.getElementById('favorites-list');
        container.innerHTML = '';

        if (this.state.favorites.length === 0) {
            container.innerHTML = '<p>No favorites added.</p>';
            return;
        }

        this.state.favorites.forEach(async city => {
            let temp = '--';
            let icon = '01d';

            try {
                const res = await fetch(`${BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`);
                if (res.ok) {
                    const data = await res.json();
                    temp = Math.round(data.main.temp);
                    icon = data.weather[0].icon;
                }
            } catch (e) { }

            const el = document.createElement('div');
            el.className = 'fav-card';
            el.innerHTML = `
                <h3>${city}</h3>
                <img src="https://openweathermap.org/img/wn/${icon}@2x.png">
                <span class="fav-temp">${temp}°</span>
            `;
            el.addEventListener('click', () => {
                this.fetchWeather(city);
                this.switchTab('today');
            });
            container.appendChild(el);
        });
    }

    // --- Helpers ---
    getTemp(celsius) {
        if (this.state.unit === 'F') return (celsius * 9 / 5) + 32;
        return celsius;
    }

    toggleUnit() {
        this.state.unit = this.state.unit === 'C' ? 'F' : 'C';
        document.getElementById('btn-unit').textContent = this.state.unit === 'C' ? '℃' : '℉';
        if (this.state.currentData) this.renderToday();
    }

    toggleTheme() {
        this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.state.theme);
        document.getElementById('btn-theme').innerHTML =
            this.state.theme === 'light' ? '<span class="theme-icon">☀️</span>' : '<span class="theme-icon">🌙</span>';
    }

    loadTheme() {
        document.body.setAttribute('data-theme', this.state.theme);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WeatherApp();
});
