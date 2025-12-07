document.addEventListener('DOMContentLoaded', function() {
    const cityInput = document.getElementById('city');
    const countryInput = document.getElementById('country');
    const manualBtn = document.getElementById('manualBtn');
    const geoBtn = document.getElementById('geoBtn');
    const prayerTimesDiv = document.getElementById('prayerTimes');
    const adhanNotification = document.getElementById('adhanNotification');
    const audioToggle = document.getElementById('audioToggle');
    const pauseIcon = document.getElementById('pauseIcon');
    const playIcon = document.getElementById('playIcon');
    const adhanPrayerName = document.getElementById('adhanPrayerName');
    
    let currentTimings = null;
    let currentLocation = null;
    let updateTimer = null;
    let isAudioPlaying = false;

    // Audio control toggle
    if (audioToggle) {
        audioToggle.addEventListener('click', function() {
            if (isAudioPlaying) {
                // Pause audio
                chrome.runtime.sendMessage({ action: 'pauseAdhan' }, (resp) => {
                    if (resp && resp.paused) {
                        isAudioPlaying = false;
                        pauseIcon.style.display = 'none';
                        playIcon.style.display = 'block';
                        audioToggle.setAttribute('aria-label', 'Resume adhan');
                        audioToggle.setAttribute('title', 'Resume');
                    }
                });
            } else {
                // Resume audio
                chrome.runtime.sendMessage({ action: 'resumeAdhan' }, (resp) => {
                    if (resp && resp.resumed) {
                        isAudioPlaying = true;
                        pauseIcon.style.display = 'block';
                        playIcon.style.display = 'none';
                        audioToggle.setAttribute('aria-label', 'Pause adhan');
                        audioToggle.setAttribute('title', 'Pause');
                    }
                });
            }
        });
    }

    // Listen for adhan start/end messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'adhanStarted') {
            isAudioPlaying = true;
            adhanPrayerName.textContent = `${message.prayer || 'Adhan'} Time`;
            adhanNotification.classList.add('active');
            pauseIcon.style.display = 'block';
            playIcon.style.display = 'none';
        } else if (message.action === 'adhanEnded') {
            isAudioPlaying = false;
            adhanNotification.classList.remove('active');
        }
    });

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

    // Load Hadith of the Day
    loadHadith();

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
        // Reschedule alarms with new timings
        try { chrome.runtime.sendMessage({ action: 'reschedule' }); } catch (e) { /* noop */ }
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
    function loadHadith() {
        const hadithContent = document.getElementById('hadithContent');
        const today = new Date().toDateString();
        // Local fallback Hadiths (short, widely cited). Used if network errors or API changes occur.
        const fallbackHadiths = [
            {
                text: 'The most beloved deeds to Allah are those that are most consistent, even if small.',
                source: 'Sahih al-Bukhari',
                narrator: 'Aisha (ra)'
            },
            {
                text: 'Indeed, actions are but by intentions, and every person will get the reward according to what he intended.',
                source: 'Sahih al-Bukhari & Muslim',
                narrator: 'Umar ibn al-Khattab (ra)'
            },
            {
                text: 'The best of you are those who learn the Qur’an and teach it.',
                source: 'Sahih al-Bukhari',
                narrator: 'Uthman ibn Affan (ra)'
            },
            {
                text: 'Make things easy, do not make them difficult; cheer the people up by conveying glad tidings to them and do not repulse them.',
                source: 'Sahih al-Bukhari',
                narrator: 'Anas ibn Malik (ra)'
            }
        ];

        chrome.storage.local.get(['hadith', 'hadithDate'], function(result) {
            if (result.hadith && result.hadithDate === today) {
                displayHadith(result.hadith);
            } else {
                fetchHadith();
            }
        });

        function fetchHadith() {
            // Ask background to fetch from hadith.gading.dev (no API key needed)
            // Rotate through collections: bukhari, muslim, tirmidzi, abudawud
            const books = ['bukhari', 'muslim', 'tirmidzi', 'abudawud'];
            const randomBook = books[Math.floor(Math.random() * books.length)];
            
            chrome.runtime.sendMessage({ action: 'fetchHadith', book: randomBook }, (resp) => {
                if (!resp || !resp.success) {
                    // console.warn('Hadith fetch via background failed:', resp?.error);
                    return useFallback();
                }
                const data = resp.data;
                // hadith.gading.dev single hadith returns { data: { number, arab, id, ... } }
                const h = data?.data;
                if (!h) {
                    console.warn('No hadith data in response');
                    return useFallback();
                }
                // Try to get English text; if not available, use Arab text as placeholder
                const text = h?.arab || h?.text || 'Hadith text';
                const source = data?.data?.name || randomBook.charAt(0).toUpperCase() + randomBook.slice(1);
                const narrator = `Hadith ${h?.number || h?.id || ''}`;
                
                const hadith = { text, source, narrator };
                chrome.storage.local.set({ hadith, hadithDate: today });
                // Log to console for debugging/visibility
                console.log('Hadith (today):', hadith);
                displayHadith(hadith);
            });
        }

        function useFallback() {
            const pick = fallbackHadiths[Math.floor(Math.random() * fallbackHadiths.length)];
            chrome.storage.local.set({ hadith: pick, hadithDate: today });
            console.log('Hadith (fallback):', pick);
            displayHadith(pick);
        }

        function displayHadith(hadith) {
            if (hadith) {
                hadithContent.innerHTML = `
                    <blockquote style="margin: 0; font-style: italic; color: #e2e8f0;">"${escapeHtml(hadith.text)}"</blockquote>
                    <cite style="display: block; margin-top: 8px; font-size: 12px; color: #cbd5e1;">
                        — ${escapeHtml(hadith.narrator)}, ${escapeHtml(hadith.source)}
                    </cite>
                `;
            } else {
                hadithContent.innerHTML = '<p style="color: #cbd5e1; font-size: 14px;">Unable to load Hadith. Please check your connection.</p>';
            }
        }
    }
});