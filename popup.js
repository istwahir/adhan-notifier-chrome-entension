document.addEventListener('DOMContentLoaded', function() {
    const cityInput = document.getElementById('city');
    const countryInput = document.getElementById('country');
    const manualBtn = document.getElementById('manualBtn');
    const geoBtn = document.getElementById('geoBtn');
    const prayerTimesDiv = document.getElementById('prayerTimes');
    let currentTimings = null;
    let currentLocation = null;
    let updateTimer = null;

    // Load stored data (location + today's timings) and render
    chrome.storage.local.get(['location', 'prayerTimes', 'date'], function(result) {
        if (result.location) currentLocation = result.location;
        if (result.prayerTimes && result.date === new Date().toDateString()) {
            currentTimings = result.prayerTimes;
            renderView();
            startAutoUpdate();
        } else {
            renderView();
        }
    });

    manualBtn.addEventListener('click', function() {
        const city = cityInput.value.trim();
        const country = countryInput.value.trim();
        if (city && country) {
            fetchPrayerTimesByCity(city, country);
        } else {
            alert('Please enter city and country.');
        }
    });

    geoBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchPrayerTimesByCoords(lat, lon);
            }, function(error) {
                alert('Error getting location: ' + error.message);
            });
        } else {
            alert('Geolocation not supported.');
        }
    });

    function fetchPrayerTimesByCity(city, country) {
        const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.code === 200) {
                    const timings = data.data.timings;
                    const location = { city, country };
                    saveData(location, timings);
                } else {
                    alert('Error fetching prayer times.');
                }
            })
            .catch(error => alert('Fetch error: ' + error));
    }

    function fetchPrayerTimesByCoords(lat, lon) {
        const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.code === 200) {
                    const timings = data.data.timings;
                    const location = { lat, lon };
                    saveData(location, timings);
                } else {
                    alert('Error fetching prayer times.');
                }
            })
            .catch(error => alert('Fetch error: ' + error));
    }

    function saveData(location, timings) {
        chrome.storage.local.set({
            location: location,
            prayerTimes: timings,
            date: new Date().toDateString()
        });
        currentLocation = location;
        currentTimings = timings;
        renderView();
        startAutoUpdate();
    }

    function renderView() {
        const timings = currentTimings;
        const prayersOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const now = new Date();

        // Header with location
        const locationLabel = (() => {
            if (!currentLocation) return '<span class="subtitle">No location saved</span>';
            if (currentLocation.city && currentLocation.country) {
                return `<span class="subtitle">Saved location: ${escapeHtml(currentLocation.city)}, ${escapeHtml(currentLocation.country)}</span>`;
            } else if (currentLocation.lat && currentLocation.lon) {
                return `<span class="subtitle">Saved location: ${Number(currentLocation.lat).toFixed(4)}, ${Number(currentLocation.lon).toFixed(4)}</span>`;
            }
            return '<span class="subtitle">Location set</span>';
        })();

        let html = '';
        html += `<div class="card" aria-label="Saved location">${locationLabel}</div>`;

        if (!timings) {
            html += `<div class="card"><div class="timeItem"><span class="name">No prayer times yet</span><span class="value">Set location to fetch</span></div></div>`;
            prayerTimesDiv.innerHTML = html;
            return;
        }

        // Build lists: past and next
        const past = [];
        let nextPrayer = null;
        let nextDate = null;

        for (const p of prayersOrder) {
            const t = timings[p];
            if (!t) continue;
            const [h, m] = t.split(':').map(Number);
            const d = new Date(now);
            d.setHours(h, m, 0, 0);
            if (d <= now) {
                past.push({ name: p, time: t, date: d });
            } else if (!nextDate || d < nextDate) {
                nextDate = d;
                nextPrayer = p;
            }
        }

        // Past prayers section
        html += `<div class="card" aria-label="Past prayers"><h4 style="margin:0 0 8px;">Already Passed</h4>`;
        if (past.length === 0) {
            html += `<div class="timeItem"><span class="name">None yet</span><span class="value">—</span></div>`;
        } else {
            past.forEach(item => {
                html += `<div class="timeItem" role="listitem"><span class="name">${item.name}</span><span class="value">${item.time}</span></div>`;
            });
        }
        html += `</div>`;

        // Next upcoming section
        html += `<div class="card" aria-label="Next upcoming prayer">`;
        if (nextPrayer) {
            const remaining = formatRemaining(now, nextDate);
            html += `<div class="timeItem" style="border-color: rgba(212,175,55,0.45); background: rgba(255,255,255,0.12)">
                        <span class="name">Next: ${nextPrayer}</span>
                        <span class="value">${timings[nextPrayer]} <span style="color:#a7f3d0; font-size:12px;">(${remaining})</span></span>
                     </div>`;
        } else {
            html += `<div class="timeItem"><span class="name">All prayers completed</span><span class="value">—</span></div>`;
        }
        html += `</div>`;

        // Full list for clarity
        html += `<div class="card" aria-label="Today's prayer times"><h4 style="margin:0 0 8px;">Today's Prayer Times</h4>`;
        prayersOrder.forEach(p => {
            if (timings[p]) {
                html += `<div class="timeItem"><span class="name">${p}</span><span class="value">${timings[p]}</span></div>`;
            }
        });
        html += `</div>`;

        prayerTimesDiv.innerHTML = html;
    }

    function startAutoUpdate() {
        if (updateTimer) clearInterval(updateTimer);
        // Update remaining time every 30 seconds for responsiveness
        updateTimer = setInterval(() => {
            if (currentTimings) renderView();
        }, 30000);
    }

    function formatRemaining(now, target) {
        const ms = target - now;
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
    }
});