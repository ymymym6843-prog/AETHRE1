/* =========================================
   AETHER - Main Application Script
   ========================================= */

const API_KEY = "c35ac75a293fcbfe0ea2fd555b4b6eab";
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

        // Feels Like - Temperature Bar
        const valFeels = document.getElementById('val-feels');
        if (valFeels) valFeels.textContent = `${Math.round(feels)}°`;

        const feelsBar = document.getElementById('feels-bar');
        if (feelsBar) {
            const feelsPct = (feels / 40) * 100;
            feelsBar.style.width = `${Math.min(100, Math.max(0, feelsPct))}%`;
        }

        // Detail Infographics (Grid)
        const detailFeels = document.getElementById('detail-feels');
        if (detailFeels) detailFeels.textContent = `${Math.round(feels)}°`;

        const detailWind = document.getElementById('detail-wind-speed');
        if (detailWind) detailWind.textContent = `${weather.wind.speed} m/s`;

        const windDir = document.getElementById('detail-wind-dir');
        if (windDir) {
            const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const dIndex = Math.round(((weather.wind.deg %= 360) < 0 ? weather.wind.deg + 360 : weather.wind.deg) / 45) % 8;
            windDir.textContent = dirs[dIndex];
        }

        const detailHum = document.getElementById('detail-humidity');
        if (detailHum) detailHum.textContent = `${weather.main.humidity}%`;

        const detailAqi = document.getElementById('detail-aqi');
        if (detailAqi) detailAqi.textContent = "Good"; // Mock

        const aqiDot = document.querySelector('.aqi-dot');
        if (aqiDot) aqiDot.style.background = '#2ecc71';
    }

    renderHourly(list) {
        const container = document.getElementById('hourly-scroll');
        if (!container) return;
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
        const container = document.querySelector('.trend-graph-container');
        const canvas = document.getElementById('trendGraph');

        if (!container) return;

        // Clear previous placeholders if any
        const existingPlaceholder = container.querySelector('.trend-placeholder');
        if (existingPlaceholder) existingPlaceholder.remove();

        if (typeof Chart === 'undefined') {
            // Fallback if Chart.js is not loaded (e.g. file:// protocol blocking scripts)
            if (canvas) canvas.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'trend-placeholder';
            placeholder.innerHTML = 'Graph unavailable<br><small>(Requires Server)</small>';
            container.appendChild(placeholder);
            return;
        }

        if (canvas) canvas.style.display = 'block';
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dailyData = [];
        const seenDates = new Set();

        list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!seenDates.has(date) && dailyData.length < 5) {
                seenDates.add(date);
                dailyData.push(item);
            }
        });

        const labels = dailyData.map(d => new Date(d.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }));
        const temps = dailyData.map(d => Math.round(this.getTemp(d.main.temp)));

        if (this.state.chartInstance) this.state.chartInstance.destroy();

        this.state.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Temperature',
                    data: temps,
                    borderColor: '#f1c40f',
                    backgroundColor: 'rgba(241, 196, 15, 0.2)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#f1c40f',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 30, bottom: 10, left: 15, right: 15 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function (context) {
                                return context.parsed.y + '°';
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        color: '#fff',
                        font: {
                            size: 11,
                            weight: 'bold'
                        },
                        formatter: function (value) {
                            return value + '°';
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(255,255,255,0.8)',
                            font: { size: 11, weight: '500' }
                        }
                    },
                    y: {
                        display: false,
                        min: Math.min(...temps) - 5,
                        max: Math.max(...temps) + 5
                    }
                }
            }
        });
    }

    renderForecastList(list) {
        const container = document.getElementById('daily-list');
        if (!container) return;
        container.innerHTML = '';

        const dailyData = [];
        const seenDates = new Set();

        list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!seenDates.has(date) && dailyData.length < 5) {
                seenDates.add(date);
                dailyData.push(item);
            }
        });

        dailyData.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const pop = Math.round((item.pop || 0) * 100);

            const el = document.createElement('div');
            el.className = 'daily-row';
            el.innerHTML = `
                <span class="daily-day">${dayName}</span>
                <div class="daily-precip">
                    <span>💧</span>
                    <span>${pop}%</span>
                </div>
                <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" class="daily-weather-icon">
                <span class="daily-temp">${Math.round(this.getTemp(item.main.temp))}°</span>
            `;
            container.appendChild(el);
        });
    }

    renderLifestyle(data) {
        // Humidity
        const lifeHum = document.getElementById('life-humidity');
        if (lifeHum) lifeHum.textContent = `${data.main.humidity}%`;

        const humFill = document.getElementById('gauge-humidity-fill');
        if (humFill) humFill.style.height = `${data.main.humidity}%`;

        // Wind
        const lifeWind = document.getElementById('life-wind-speed');
        if (lifeWind) lifeWind.textContent = `${data.wind.speed} m/s`;

        const windArrow = document.getElementById('compass-arrow');
        if (windArrow) windArrow.style.transform = `rotate(${data.wind.deg}deg)`;

        // UV (Mock)
        const uv = 5;
        const uvVal = document.getElementById('life-uv');
        if (uvVal) uvVal.textContent = `UV: ${uv}`;

        const uvFill = document.getElementById('gauge-uv-fill'); // Check ID
        // If using transform rotate for semicircle
        const uvGauge = document.getElementById('gauge-uv');
        if (uvGauge) {
            const uvDeg = -180 + (uv / 11) * 180;
            uvGauge.style.transform = `rotate(${uvDeg}deg)`;
        }

        // Pressure
        const lifePress = document.getElementById('life-pressure');
        if (lifePress) lifePress.textContent = `${data.main.pressure} hPa`;

        const pressBar = document.getElementById('bar-pressure');
        if (pressBar) {
            const pPct = Math.min(100, Math.max(0, (data.main.pressure - 950) / 100 * 100));
            pressBar.style.width = `${pPct}%`;
        }
    }

    renderOutfit(data) {
        const temp = this.getTemp(data.main.temp);
        let t = this.state.unit === 'F' ? (temp - 32) * 5 / 9 : temp;

        let icon = '👕';
        let text = "Comfortable weather.";
        if (t < 10) { icon = '🧥'; text = "Wear a warm coat."; }
        else if (t > 25) { icon = '🎽'; text = "Stay cool and hydrated."; }

        const outIcon = document.getElementById('outfit-icon');
        if (outIcon) outIcon.textContent = icon;

        const outText = document.getElementById('outfit-text');
        if (outText) outText.textContent = text;
    }

    renderCityLists() {
        const globals = ['New York', 'London', 'Paris', 'Tokyo'];
        const domestic = ['Seoul', 'Busan', 'Jeju', 'Incheon'];

        this.fillCityList(document.getElementById('list-global'), globals);
        this.fillCityList(document.getElementById('list-domestic'), domestic);
    }

    async fillCityList(container, cities) {
        if (!container) return;
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
                <span class="city-name">${city}</span>
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
        if (this.state.mapInstance) return; // Prevent re-init

        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;

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
        this.animateConstellation();
        this.animateMeteors();
    }

    animateSun(sunrise, sunset) {
        const now = Math.floor(Date.now() / 1000);
        const totalDaylight = sunset - sunrise;
        const elapsed = now - sunrise;
        const targetProgress = Math.min(1, Math.max(0, elapsed / totalDaylight));

        const sunEl = document.getElementById('sun-body');
        const radius = 120;

        // Animate from 0 to targetProgress
        let currentProgress = 0;
        const duration = 1000; // 1 second animation
        const startTime = performance.now();

        const animate = (time) => {
            const timeElapsed = time - startTime;
            const ease = Math.min(1, timeElapsed / duration);

            currentProgress = targetProgress * ease;

            const angle = currentProgress * 180;
            const rad = angle * (Math.PI / 180);
            const sunX = -radius * Math.cos(rad);
            const sunY = radius * Math.sin(rad);

            if (sunEl) {
                sunEl.style.left = `calc(50% + ${sunX}px)`;
                sunEl.style.bottom = `${20 + sunY}px`;
            }

            if (timeElapsed < duration) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);

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


        const moonPhaseName = document.getElementById('moon-phase-name');
        const moonIllumination = document.getElementById('moon-illumination');
        const moonDaysInfo = document.getElementById('moon-days-info');

        if (moonPhaseName) moonPhaseName.textContent = phaseName;
        if (moonIllumination) moonIllumination.textContent = `${illumination}% Illuminated`;
        if (moonDaysInfo) moonDaysInfo.textContent = `Next phase in ${daysToNext} days`;


        // Update visual
        const moonVisual = document.getElementById('moon-visual');
        if (moonVisual) {
            const p = phase * 100;
            moonVisual.style.background = `radial-gradient(circle at ${p}% 50%, #f4f4f4 20%, #333 60%)`;
        }
    }

    animateConstellation() {
        const canvas = document.getElementById('constellationCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = 300;
        const height = 200;

        // Zodiac 12 Constellations (황도12궁)
        const constellations = {
            aries: {
                name: 'Aries ♈ (양자리)',
                stars: [
                    { x: 0.35, y: 0.45 },
                    { x: 0.50, y: 0.35 },
                    { x: 0.65, y: 0.50 }
                ],
                connections: [[0, 1], [1, 2]]
            },
            taurus: {
                name: 'Taurus ♉ (황소자리)',
                stars: [
                    { x: 0.30, y: 0.40 }, // Aldebaran
                    { x: 0.45, y: 0.30 },
                    { x: 0.55, y: 0.35 },
                    { x: 0.65, y: 0.45 },
                    { x: 0.50, y: 0.55 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]]
            },
            gemini: {
                name: 'Gemini ♊ (쌍둥이자리)',
                stars: [
                    { x: 0.25, y: 0.30 }, // Castor
                    { x: 0.25, y: 0.60 },
                    { x: 0.40, y: 0.70 },
                    { x: 0.55, y: 0.30 }, // Pollux
                    { x: 0.55, y: 0.60 },
                    { x: 0.70, y: 0.70 }
                ],
                connections: [[0, 1], [1, 2], [3, 4], [4, 5]]
            },
            cancer: {
                name: 'Cancer ♋ (게자리)',
                stars: [
                    { x: 0.35, y: 0.40 },
                    { x: 0.50, y: 0.35 },
                    { x: 0.65, y: 0.40 },
                    { x: 0.50, y: 0.55 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [3, 0]]
            },
            leo: {
                name: 'Leo ♌ (사자자리)',
                stars: [
                    { x: 0.25, y: 0.50 },
                    { x: 0.35, y: 0.35 }, // Regulus
                    { x: 0.50, y: 0.30 },
                    { x: 0.65, y: 0.40 },
                    { x: 0.75, y: 0.55 },
                    { x: 0.55, y: 0.65 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]]
            },
            virgo: {
                name: 'Virgo ♍ (처녀자리)',
                stars: [
                    { x: 0.30, y: 0.30 },
                    { x: 0.45, y: 0.25 }, // Spica
                    { x: 0.60, y: 0.35 },
                    { x: 0.50, y: 0.50 },
                    { x: 0.40, y: 0.65 }
                ],
                connections: [[0, 1], [1, 2], [1, 3], [3, 4]]
            },
            libra: {
                name: 'Libra ♎ (천칭자리)',
                stars: [
                    { x: 0.30, y: 0.40 },
                    { x: 0.45, y: 0.35 },
                    { x: 0.55, y: 0.35 },
                    { x: 0.70, y: 0.40 },
                    { x: 0.50, y: 0.55 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [1, 4], [2, 4]]
            },
            scorpius: {
                name: 'Scorpius ♏ (전갈자리)',
                stars: [
                    { x: 0.25, y: 0.35 }, // Antares
                    { x: 0.35, y: 0.40 },
                    { x: 0.45, y: 0.45 },
                    { x: 0.55, y: 0.50 },
                    { x: 0.65, y: 0.60 },
                    { x: 0.70, y: 0.70 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]
            },
            sagittarius: {
                name: 'Sagittarius ♐ (궁수자리)',
                stars: [
                    { x: 0.30, y: 0.50 },
                    { x: 0.40, y: 0.35 },
                    { x: 0.55, y: 0.30 },
                    { x: 0.65, y: 0.45 },
                    { x: 0.55, y: 0.60 },
                    { x: 0.45, y: 0.65 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]
            },
            capricornus: {
                name: 'Capricornus ♑ (염소자리)',
                stars: [
                    { x: 0.30, y: 0.40 },
                    { x: 0.45, y: 0.35 },
                    { x: 0.60, y: 0.45 },
                    { x: 0.70, y: 0.60 },
                    { x: 0.50, y: 0.65 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [2, 4]]
            },
            aquarius: {
                name: 'Aquarius ♒ (물병자리)',
                stars: [
                    { x: 0.25, y: 0.35 },
                    { x: 0.40, y: 0.30 },
                    { x: 0.55, y: 0.35 },
                    { x: 0.70, y: 0.40 },
                    { x: 0.50, y: 0.55 },
                    { x: 0.35, y: 0.65 }
                ],
                connections: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]]
            },
            pisces: {
                name: 'Pisces ♓ (물고기자리)',
                stars: [
                    { x: 0.20, y: 0.40 },
                    { x: 0.30, y: 0.50 },
                    { x: 0.45, y: 0.55 },
                    { x: 0.60, y: 0.50 },
                    { x: 0.75, y: 0.45 },
                    { x: 0.50, y: 0.35 }
                ],
                connections: [[0, 1], [1, 2], [2, 5], [5, 3], [3, 4]]
            }
        };

        // Select a random constellation
        const constellationKeys = Object.keys(constellations);
        const selectedKey = constellationKeys[Math.floor(Math.random() * constellationKeys.length)];
        const constellation = constellations[selectedKey];

        // Convert percentage coordinates to canvas coordinates
        const targetStars = constellation.stars.map(s => ({
            targetX: s.x * width,
            targetY: s.y * height,
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.8, // Increased velocity for more dynamic floating
            vy: (Math.random() - 0.5) * 0.8,
            radius: 2 + Math.random() * 1.5,
            glowPhase: Math.random() * Math.PI * 2
        }));

        let phase = 'floating';
        let formingProgress = 0;
        let connectingProgress = 0;
        let time = 0;

        const animate = () => {
            time += 0.016;
            ctx.clearRect(0, 0, width, height);

            // Phase 1: Random floating (3 seconds for more dramatic effect)
            if (phase === 'floating' && time < 3) {
                targetStars.forEach(star => {
                    star.x += star.vx;
                    star.y += star.vy;

                    // Smooth bounce with damping
                    if (star.x < 10 || star.x > width - 10) {
                        star.vx *= -0.8;
                        star.x = Math.max(10, Math.min(width - 10, star.x));
                    }
                    if (star.y < 10 || star.y > height - 10) {
                        star.vy *= -0.8;
                        star.y = Math.max(10, Math.min(height - 10, star.y));
                    }
                });
            }
            // Phase 2: Forming constellation (smoother transition)
            else if (phase === 'floating' || (phase === 'forming' && formingProgress < 1)) {
                if (phase === 'floating') {
                    phase = 'forming';
                    // Slow down stars before forming
                    targetStars.forEach(star => {
                        star.vx *= 0.5;
                        star.vy *= 0.5;
                    });
                }

                formingProgress += 0.012; // Slower for smoother animation
                const easeProgress = this.easeInOutCubic(Math.min(formingProgress, 1));

                targetStars.forEach(star => {
                    // Smooth interpolation
                    star.x += (star.targetX - star.x) * easeProgress * 0.15;
                    star.y += (star.targetY - star.y) * easeProgress * 0.15;
                });

                if (formingProgress >= 1) {
                    phase = 'connecting';
                    // Snap to exact positions
                    targetStars.forEach(star => {
                        star.x = star.targetX;
                        star.y = star.targetY;
                    });
                }
            }
            // Phase 3: Connecting stars
            else if (phase === 'connecting') {
                connectingProgress += 0.025; // Slightly faster line drawing
            }

            // Draw connecting lines with smooth progression
            if (phase === 'connecting' && connectingProgress > 0) {
                const lineProgress = Math.min(connectingProgress, 1);
                const totalConnections = constellation.connections.length;
                const visibleConnections = Math.floor(lineProgress * totalConnections);

                ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(100, 150, 255, 0.6)';

                constellation.connections.forEach((conn, idx) => {
                    if (idx < visibleConnections) {
                        const star1 = targetStars[conn[0]];
                        const star2 = targetStars[conn[1]];
                        ctx.beginPath();
                        ctx.moveTo(star1.x, star1.y);
                        ctx.lineTo(star2.x, star2.y);
                        ctx.stroke();
                    } else if (idx === visibleConnections) {
                        const star1 = targetStars[conn[0]];
                        const star2 = targetStars[conn[1]];
                        const segmentProgress = (lineProgress * totalConnections) - visibleConnections;
                        const partialX = star1.x + (star2.x - star1.x) * segmentProgress;
                        const partialY = star1.y + (star2.y - star1.y) * segmentProgress;
                        ctx.beginPath();
                        ctx.moveTo(star1.x, star1.y);
                        ctx.lineTo(partialX, partialY);
                        ctx.stroke();
                    }
                });
            }

            // Draw stars with enhanced glow
            ctx.shadowBlur = 0;
            targetStars.forEach(star => {
                star.glowPhase += 0.03;
                const glowIntensity = 0.7 + Math.sin(star.glowPhase) * 0.3;
                const pulseSize = star.radius * (1 + Math.sin(star.glowPhase * 1.5) * 0.2);

                // Outer glow
                ctx.beginPath();
                ctx.arc(star.x, star.y, pulseSize * 2.5, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, pulseSize * 2.5);
                gradient.addColorStop(0, `rgba(255, 220, 100, ${glowIntensity * 0.4})`);
                gradient.addColorStop(0.5, `rgba(255, 200, 50, ${glowIntensity * 0.2})`);
                gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();

                // Middle glow
                ctx.beginPath();
                ctx.arc(star.x, star.y, pulseSize * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 230, 150, ${glowIntensity * 0.5})`;
                ctx.shadowBlur = 8 * glowIntensity;
                ctx.shadowColor = 'rgba(255, 220, 100, 0.8)';
                ctx.fill();

                // Core star
                ctx.beginPath();
                ctx.arc(star.x, star.y, pulseSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 220, ${0.9 + glowIntensity * 0.1})`;
                ctx.shadowBlur = 5 * glowIntensity;
                ctx.shadowColor = 'rgba(255, 240, 150, 1)';
                ctx.fill();

                // Bright center
                ctx.beginPath();
                ctx.arc(star.x, star.y, pulseSize * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 3;
                ctx.shadowColor = '#ffff00';
                ctx.fill();
            });

            ctx.shadowBlur = 0;

            // Update constellation name with fade-in
            const overlayName = document.querySelector('.overlay-name');
            if (overlayName && phase === 'connecting' && connectingProgress > 0.3) {
                overlayName.textContent = constellation.name;
                overlayName.style.opacity = Math.min((connectingProgress - 0.3) * 1.5, 1);
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    animateMeteors() {
        const canvas = document.getElementById('meteorCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const meteors = [];
        const stars = [];

        // Create background stars
        for (let i = 0; i < 50; i++) {
            stars.push({
                x: Math.random() * 300,
                y: Math.random() * 200,
                size: Math.random() * 1.5,
                twinkle: Math.random() * Math.PI * 2
            });
        }

        // Create meteors
        for (let i = 0; i < 5; i++) {
            meteors.push({
                x: Math.random() * 300 + 100,
                y: Math.random() * 100 - 50,
                speed: 3 + Math.random() * 3,
                length: 40 + Math.random() * 30,
                brightness: 0.7 + Math.random() * 0.3,
                delay: Math.random() * 100
            });
        }

        let frame = 0;

        const animate = () => {
            frame++;
            ctx.fillStyle = 'rgba(10, 10, 30, 0.3)';
            ctx.fillRect(0, 0, 300, 200);

            // Draw twinkling stars
            stars.forEach(star => {
                star.twinkle += 0.05;
                const alpha = 0.3 + Math.sin(star.twinkle) * 0.3;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw meteors
            meteors.forEach(m => {
                if (frame < m.delay) return;

                m.x -= m.speed;
                m.y += m.speed * 0.6;

                if (m.x < -100 || m.y > 250) {
                    m.x = 300 + Math.random() * 200;
                    m.y = Math.random() * 100 - 50;
                    m.delay = frame + Math.random() * 50;
                }

                const gradient = ctx.createLinearGradient(m.x, m.y, m.x + m.length, m.y - m.length * 0.6);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${m.brightness})`);
                gradient.addColorStop(0.3, `rgba(200, 220, 255, ${m.brightness * 0.6})`);
                gradient.addColorStop(0.7, `rgba(100, 150, 255, ${m.brightness * 0.3})`);
                gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');

                ctx.strokeStyle = `rgba(150, 180, 255, ${m.brightness * 0.3})`;
                ctx.lineWidth = 4;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(150, 200, 255, 0.8)';
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x + m.length, m.y - m.length * 0.6);
                ctx.stroke();

                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2;
                ctx.shadowBlur = 5;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x + m.length, m.y - m.length * 0.6);
                ctx.stroke();

                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ffffff';
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.shadowBlur = 0;
            requestAnimationFrame(animate);
        };

        animate();
        this.displayMeteorForecast();
    }

    displayMeteorForecast() {
        const meteorInfo = document.getElementById('meteor-info');
        if (!meteorInfo) return;

        const now = new Date();
        const month = now.getMonth() + 1;

        const showers = [
            { name: 'Quadrantids', peak: '1/3-1/4', rate: 120, active: '12/28-1/12', month: 1 },
            { name: 'Lyrids', peak: '4/22-4/23', rate: 18, active: '4/16-4/25', month: 4 },
            { name: 'Eta Aquarids', peak: '5/6-5/7', rate: 50, active: '4/19-5/28', month: 5 },
            { name: 'Perseids', peak: '8/12-8/13', rate: 100, active: '7/17-8/24', month: 8 },
            { name: 'Orionids', peak: '10/21-10/22', rate: 25, active: '10/2-11/7', month: 10 },
            { name: 'Leonids', peak: '11/17-11/18', rate: 15, active: '11/6-11/30', month: 11 },
            { name: 'Geminids', peak: '12/13-12/14', rate: 120, active: '12/4-12/17', month: 12 }
        ];

        // Find the next upcoming shower
        let nextShower = showers.find(s => s.month > month) || showers[0];

        meteorInfo.innerHTML = `
            <div class="meteor-forecast">
                <div class="forecast-title">🌠 Upcoming Meteor Shower</div>
                <div class="forecast-name">${nextShower.name}</div>
                <div class="forecast-details">
                    <div class="forecast-item">
                        <span class="forecast-label">Peak:</span>
                        <span class="forecast-value">${nextShower.peak}</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">Rate:</span>
                        <span class="forecast-value">Up to ${nextShower.rate} meteors/hour</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">Active Period:</span>
                        <span class="forecast-value">${nextShower.active}</span>
                    </div>
                </div>
                <div class="forecast-tip">💡 Best viewing: After midnight, away from city lights</div>
            </div>
        `;
    }

    // --- Background ---
    updateBackground(weatherCode) {
        const bgContainer = document.querySelector('.background-container');
        if (!bgContainer) return;

        bgContainer.className = 'background-container';
        bgContainer.innerHTML = '';

        const hour = new Date().getHours();
        const isNight = hour >= 19 || hour < 6;

        if (isNight) {
            bgContainer.classList.add('night');
            this.addStarEffect();
        } else {
            bgContainer.classList.add('day');
        }

        // Weather specific effects
        if (weatherCode >= 200 && weatherCode < 300) {
            bgContainer.classList.add('storm');
            this.addRainEffect();
            this.addThunderEffect();
        } else if (weatherCode >= 300 && weatherCode < 600) {
            bgContainer.classList.add('rain');
            this.addRainEffect();
        } else if (weatherCode >= 600 && weatherCode < 700) {
            bgContainer.classList.add('snow');
            this.addSnowEffect();
        } else if (weatherCode >= 700 && weatherCode < 800) {
            bgContainer.classList.add('mist');
            this.addFogEffect();
        } else if (weatherCode === 800) {
            bgContainer.classList.add('clear');
            if (!isNight) this.addSunEffect();
        } else if (weatherCode > 800) {
            bgContainer.classList.add('clouds');
            this.addCloudEffect();
        }
    }

    addSunEffect() {
        const bgContainer = document.querySelector('.background-container');
        const sun = document.createElement('div');
        sun.className = 'bg-sun';
        bgContainer.appendChild(sun);
    }

    addStarEffect() {
        const bgContainer = document.querySelector('.background-container');
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.animationDelay = `${Math.random() * 2}s`;
            star.style.opacity = Math.random();
            bgContainer.appendChild(star);
        }
    }

    addRainEffect() {
        const bgContainer = document.querySelector('.background-container');
        for (let i = 0; i < 100; i++) {
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
        for (let i = 0; i < 50; i++) {
            const flake = document.createElement('div');
            flake.className = 'snow-flake';
            flake.style.left = `${Math.random() * 100}%`;
            flake.style.width = `${2 + Math.random() * 5}px`;
            flake.style.height = flake.style.width;
            flake.style.animationDuration = `${3 + Math.random() * 2}s`;
            flake.style.animationDelay = `${Math.random() * 5}s`;
            bgContainer.appendChild(flake);
        }
    }

    addCloudEffect() {
        const bgContainer = document.querySelector('.background-container');
        for (let i = 0; i < 5; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.top = `${10 + Math.random() * 40}%`;
            cloud.style.width = `${150 + Math.random() * 150}px`;
            cloud.style.height = `${60 + Math.random() * 40}px`;
            cloud.style.animationDuration = `${20 + Math.random() * 20}s`;
            cloud.style.animationDelay = `${i * -5}s`;
            bgContainer.appendChild(cloud);
        }
    }

    addFogEffect() {
        const bgContainer = document.querySelector('.background-container');
        for (let i = 0; i < 3; i++) {
            const fog = document.createElement('div');
            fog.className = 'fog-layer';
            bgContainer.appendChild(fog);
        }
    }

    addThunderEffect() {
        const bgContainer = document.querySelector('.background-container');
        const lightning = document.createElement('div');
        lightning.className = 'lightning';
        bgContainer.appendChild(lightning);
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
