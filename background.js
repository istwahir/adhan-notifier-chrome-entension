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
                playAdhan();
            }
        });
    }
});

function playAdhan() {
    // Use offscreen document to play audio
    chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play Adhan audio'
    }).then(() => {
        chrome.runtime.sendMessage({ action: 'playAdhan' });
    }).catch(() => {
        // If already exists, send message
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'reschedule') {
        schedulePrayers();
    }
});
        chrome.runtime.sendMessage({ action: 'playAdhan' });
    });
}