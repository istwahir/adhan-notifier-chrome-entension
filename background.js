chrome.runtime.onInstalled.addListener(() => {
    schedulePrayers();
});

chrome.runtime.onStartup.addListener(() => {
    schedulePrayers();
});

function schedulePrayers() {
    chrome.alarms.clearAll(() => {
        chrome.storage.local.get(['prayerTimes', 'date', 'enabledPrayers'], function(result) {
            if (result.prayerTimes && result.date === new Date().toDateString()) {
                const prayers = result.enabledPrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                prayers.forEach(prayer => {
                    const timeStr = result.prayerTimes[prayer];
                    if (timeStr) {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        const now = new Date();
                        const prayerTime = new Date(now);
                        prayerTime.setHours(hours, minutes, 0, 0);
                        if (prayerTime > now) {
                            const delayInMinutes = (prayerTime - now) / 60000;
                            chrome.alarms.create(`prayer_${prayer}`, { delayInMinutes });
                        }
                    }
                });
            }
        });
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('prayer_')) {
        const prayer = alarm.name.split('_')[1];
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Adhan Time',
            message: `It's time for ${prayer} prayer.`
        });
        // Check if audio enabled
        chrome.storage.local.get(['playAudio'], function(result) {
            if (result.playAudio) {
                playAdhan(prayer);
            }
        });
    }
});

function playAdhan(prayer) {
    // Use offscreen document to play audio
    chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play Adhan audio'
    }).then(() => {
        chrome.runtime.sendMessage({ action: 'playAdhan', prayer: prayer });
    }).catch(() => {
        // If already exists, send message
        chrome.runtime.sendMessage({ action: 'playAdhan', prayer: prayer });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'reschedule') {
        schedulePrayers();
    }
    // Route audio control messages to offscreen document
    else if (message.action === 'pauseAdhan' || message.action === 'resumeAdhan' || message.action === 'getAudioState') {
        chrome.runtime.sendMessage(message, sendResponse);
        return true; // Keep channel open for async response
    }
    // Broadcast adhan state changes to all extension contexts (popup, etc.)
    else if (message.action === 'adhanStarted' || message.action === 'adhanEnded') {
        chrome.runtime.sendMessage(message); // Broadcast to popup if open
    }
});

// ===== Hadith API relay (keep key out of frontend) =====
// Using hadith.gading.dev - free, no API key required
// Simple approach: fetch specific hadith by number

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'fetchHadith') {
        // Use hadith.gading.dev which doesn't require API key
        const book = request.book || 'bukhari'; // Default to Sahih Bukhari
        // Get a random single hadith number (bukhari has ~7000, muslim ~7000, etc)
        const maxNumbers = { bukhari: 7008, muslim: 7190, abudawud: 5274, tirmidzi: 3891 };
        const maxNum = maxNumbers[book] || 1000;
        const randomNum = Math.floor(Math.random() * maxNum) + 1;
        const apiUrl = `https://api.hadith.gading.dev/books/${book}/${randomNum}`;
        
        fetch(apiUrl)
            .then(async res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                const ct = res.headers.get('content-type') || '';
                const body = await res.text();
                if (!ct.includes('application/json')) {
                    throw new Error('Unexpected content-type; not JSON');
                }
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    throw new Error('Response is not valid JSON');
                }
                return data;
            })
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        
        // Return true to indicate async response
        return true;
    }
});