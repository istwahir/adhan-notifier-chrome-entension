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
    const closeAdhan = document.getElementById('closeAdhan');
    
    let currentTimings = null;
    let currentLocation = null;
    let updateTimer = null;
    let isAudioPlaying = false;

    // Check if adhan is currently playing when popup opens
    checkAdhanState();

    function checkAdhanState() {
        chrome.runtime.sendMessage({ action: 'getAudioState' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Could not get audio state:', chrome.runtime.lastError.message);
                return;
            }
            if (response && response.isPlaying) {
                console.log('Adhan is currently playing, restoring banner');
                // Get current prayer name from storage
                chrome.storage.local.get(['currentPrayer'], (result) => {
                    const prayer = result.currentPrayer || 'Adhan';
                    adhanPrayerName.textContent = `${prayer} Time`;
                    adhanNotification.classList.add('active');
                    pauseIcon.style.display = 'block';
                    playIcon.style.display = 'none';
                    isAudioPlaying = true;
                });
            }
        });
    }

    // Close adhan button - stops audio and hides banner
    if (closeAdhan) {
        closeAdhan.addEventListener('click', function() {
            console.log('Close adhan button clicked');
            // Stop audio
            chrome.runtime.sendMessage({ action: 'stopAdhan' }, (resp) => {
                if (resp && resp.stopped) {
                    isAudioPlaying = false;
                    adhanNotification.classList.remove('active');
                    pauseIcon.style.display = 'block';
                    playIcon.style.display = 'none';
                    console.log('Adhan stopped and notification hidden');
                }
            });
        });
    }

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
            // Show banner and ensure audio is actually playing
            adhanPrayerName.textContent = `${message.prayer || 'Adhan'} Time`;
            adhanNotification.classList.add('active');
            pauseIcon.style.display = 'block';
            playIcon.style.display = 'none';
            isAudioPlaying = true;
            ensureAudioPlayback();
        } else if (message.action === 'adhanEnded') {
            isAudioPlaying = false;
            adhanNotification.classList.remove('active');
        }
    });

    // Try to recover playback if the offscreen audio failed to start
    function ensureAudioPlayback() {
        // Query current audio state, and attempt a resume with limited retries
        let attempts = 0;
        const maxAttempts = 3;

        const check = () => {
            chrome.runtime.sendMessage({ action: 'getAudioState' }, (resp) => {
                const playing = resp && resp.isPlaying;
                if (playing) {
                    // Audio is playing; keep UI in pause state
                    pauseIcon.style.display = 'block';
                    playIcon.style.display = 'none';
                    isAudioPlaying = true;
                    return; // done
                }
                // Not playing — try resume if under attempts
                if (attempts < maxAttempts) {
                    attempts++;
                    chrome.runtime.sendMessage({ action: 'resumeAdhan' }, (r) => {
                        // Re-check after a short delay
                        setTimeout(check, 400);
                    });
                } else {
                    // Give up: keep banner, show play button for manual attempt
                    isAudioPlaying = false;
                    pauseIcon.style.display = 'none';
                    playIcon.style.display = 'block';
                    // Optional: provide subtle message
                    const msgEl = document.querySelector('#adhanNotification .adhan-message');
                    if (msgEl) msgEl.textContent = 'Adhan ready. Tap to play.';
                }
            });
        };
        // Initial check shortly after banner appears
        setTimeout(check, 300);
    }

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

    // Play Adhan button
    const playAdhanBtn = document.getElementById('playAdhanBtn');
    if (playAdhanBtn) {
        playAdhanBtn.addEventListener('click', function() {
            console.log('Play Adhan button clicked');
            // Send message to background script to play adhan
            chrome.runtime.sendMessage({ action: 'testPlayAdhan', prayer: 'Test' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending play message:', chrome.runtime.lastError);
                } else {
                    console.log('Play adhan response:', response);
                }
            });
        });
    }

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
        chrome.runtime.sendMessage({ action: 'reschedule' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Reschedule message error:', chrome.runtime.lastError.message);
            }
        });
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
        html += `<div class="card" aria-label="Past prayers"><h4 style="margin:8px 0 8px 0;">Already Passed</h4>`;
        if (past.length === 0) {
            html += `<div class="timeItem"><span class="name">None yet</span><span class="value">—</span></div>`;
        } else {
            past.forEach(item => {
                html += `<div class="timeItem" role="listitem" style="margin:8px 0 8px 0;"><span class="name">${item.name}</span><span class="value">${item.time}</span></div>`;
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
        html += `<div class="card" aria-label="Today's prayer times"><h4>Today's Prayer Times</h4>`;
        prayersOrder.forEach(p => {
            if (timings[p]) {
                html += `<div class="timeItem" style="margin:8px 0 8px 0;"><span class="name">${p}</span><span class="value">${timings[p]}</span></div>`;
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
        // const fallbackHadiths = [
        //     {
        //         text: 'The most beloved deeds to Allah are those that are most consistent, even if small.',
        //         source: 'Sahih al-Bukhari',
        //         narrator: 'Aisha (ra)'
        //     },
        //     {
        //         text: 'Indeed, actions are but by intentions, and every person will get the reward according to what he intended.',
        //         source: 'Sahih al-Bukhari & Muslim',
        //         narrator: 'Umar ibn al-Khattab (ra)'
        //     },
        //     {
        //         text: 'The best of you are those who learn the Qur’an and teach it.',
        //         source: 'Sahih al-Bukhari',
        //         narrator: 'Uthman ibn Affan (ra)'
        //     },
        //     {
        //         text: 'Make things easy, do not make them difficult; cheer the people up by conveying glad tidings to them and do not repulse them.',
        //         source: 'Sahih al-Bukhari',
        //         narrator: 'Anas ibn Malik (ra)'
        //     }
        // ];

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
                    console.warn('Hadith fetch via background failed:', resp?.error);
                    return useFallback();
                }
                const data = resp.data;
                console.log('Hadith API response:', data);
                
                // hadith.gading.dev returns: { code, message, data: { name, id, available, requested, hadiths: [...] } }
                const hadiths = data?.data?.hadiths;
                if (!hadiths || hadiths.length === 0) {
                    console.warn('No hadith data in response');
                    return useFallback();
                }
                
                // Get the first hadith from the array
                const h = hadiths[0];
                
                console.log('Hadith object:', h);
                console.log('Hadith contents:', h?.contents);
                
                // Get English text from contents array if available
                let text = 'Hadith text not available';
                if (h?.contents && Array.isArray(h.contents)) {
                    const englishContent = h.contents.find(c => c.lang === 'en' || c.lang === 'english');
                    const arabContent = h.contents.find(c => c.lang === 'ar' || c.lang === 'arab');
                    
                    console.log('English content found:', !!englishContent);
                    console.log('Arabic content found:', !!arabContent);
                    
                    if (englishContent?.body) {
                        text = englishContent.body;
                        console.log('Using English text');
                    } else if (arabContent?.body) {
                        text = arabContent.body;
                        console.log('Using Arabic text (English not available)');
                    } else {
                        text = h.arab || 'Hadith text';
                        console.log('Using fallback text');
                    }
                } else {
                    text = h?.english || h?.arab || 'Hadith text';
                    console.log('No contents array, using direct properties');
                }
                
                const source = data?.data?.name || randomBook.charAt(0).toUpperCase() + randomBook.slice(1);
                const narrator = h?.number ? `Hadith #${h.number}` : 'Hadith';
                
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
            if (!hadithContent) return;
            
            if (hadith && hadith.text) {
                hadithContent.innerHTML = `
                    <blockquote style="margin: 0; padding: 10px; font-style: italic; color: #e2e8f0; line-height: 1.6; border-left: 3px solid var(--gold); background: rgba(255,255,255,0.03); border-radius: 8px;">
                        "${escapeHtml(hadith.text)}"
                    </blockquote>
                    <cite style="display: block; margin-top: 10px; font-size: 12px; color: #cbd5e1; text-align: right;">
                        — ${escapeHtml(hadith.narrator || 'Hadith')}, ${escapeHtml(hadith.source || 'Collection')}
                    </cite>
                `;
            } else {
                hadithContent.innerHTML = '<p style="color: #cbd5e1; font-size: 14px;">Unable to load Hadith. Please check your connection.</p>';
            }
        }
    }
});