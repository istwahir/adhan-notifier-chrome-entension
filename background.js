chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed, initializing...');
    setupOffscreenDocument();
    schedulePrayers();
    ensureTickAlarm();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension startup, initializing...');
    setupOffscreenDocument();
    schedulePrayers();
    ensureTickAlarm();
});

// Create offscreen document once at startup and keep it alive
async function setupOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
        console.log('Offscreen document already exists');
        return;
    }
    
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Play Adhan audio at prayer times'
        });
        console.log('Offscreen document created successfully');
    } catch (error) {
        console.error('Error creating offscreen document:', error);
    }
}

function schedulePrayers() {
    console.log('📅 schedulePrayers() called');
    chrome.alarms.clearAll(() => {
        console.log('🗑️  All existing alarms cleared');
        chrome.storage.local.get(['prayerTimes', 'date', 'enabledPrayers'], function(result) {
            console.log('📦 Storage retrieved:', {
                date: result.date,
                todayIs: new Date().toDateString(),
                dateMatch: result.date === new Date().toDateString(),
                prayerTimes: result.prayerTimes,
                enabledPrayers: result.enabledPrayers
            });
            
            if (result.prayerTimes && result.date === new Date().toDateString()) {
                const prayers = result.enabledPrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                console.log('✅ Prayer times valid for today. Processing:', prayers);
                
                let alarmsCreated = 0;
                prayers.forEach(prayer => {
                    const timeStr = result.prayerTimes[prayer];
                    if (timeStr) {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        const now = new Date();
                        const prayerTime = new Date(now);
                        prayerTime.setHours(hours, minutes, 0, 0);
                        
                        console.log(`⏰ ${prayer}: ${timeStr} -> ${prayerTime.toLocaleTimeString()}`);
                        
                        if (prayerTime > now) {
                            const delayInMinutes = (prayerTime - now) / 60000;
                            chrome.alarms.create(`prayer_${prayer}`, { delayInMinutes });
                            console.log(`   ✅ Alarm created for ${prayer} in ${delayInMinutes.toFixed(2)} minutes`);
                            alarmsCreated++;
                        } else {
                            console.log(`   ⏭️  Skipped ${prayer} (already passed)`);
                        }
                    } else {
                        console.log(`   ⚠️  No time found for ${prayer}`);
                    }
                });
                
                console.log(`\n✅ Total alarms created: ${alarmsCreated}`);
            } else {
                console.log('❌ Cannot schedule: prayer times missing or date mismatch');
            }
            // Always ensure watchdog tick alarm exists (we cleared all above)
            ensureTickAlarm();
        });
    });
}

// Ensure we have a periodic tick to recover if main alarms fail or service worker slept
function ensureTickAlarm() {
    chrome.alarms.get('tick', (a) => {
        if (!a) {
            chrome.alarms.create('tick', { periodInMinutes: 1 });
            console.log('⏲️  Created minute tick alarm for redundancy');
        } else {
            console.log('⏲️  Minute tick alarm already exists');
        }
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('🔔 ALARM FIRED:', alarm.name, 'at', new Date().toLocaleTimeString());
    
    if (alarm.name === 'tick') {
        // Redundant checker to ensure adhan plays near prayer time even if primary alarm missed
        chrome.storage.local.get(['prayerTimes', 'date', 'enabledPrayers', 'firedPrayers', 'firedPrayersDate', 'playAudio'], (result) => {
            const today = new Date().toDateString();
            if (result.date !== today) {
                console.log('📆 Date changed. Rescheduling for today...');
                // Reset fired flags
                chrome.storage.local.set({ firedPrayers: [], firedPrayersDate: today }, () => {
                    schedulePrayers();
                });
                return;
            }
            if (!result.prayerTimes) return;
            if (!result.playAudio) {
                // Respect user setting; do not auto-play
                return;
            }
            const firedDate = result.firedPrayersDate;
            let fired = Array.isArray(result.firedPrayers) && firedDate === today ? result.firedPrayers : [];
            const now = new Date();
            const prayers = result.enabledPrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const windowBeforeMin = 0.5; // 30 seconds before
            const windowAfterMin = 3;    // 3 minutes after
            let triggered = false;
            prayers.forEach(prayer => {
                const timeStr = result.prayerTimes[prayer];
                if (!timeStr) return;
                const [h, m] = timeStr.split(':').map(Number);
                const t = new Date(now);
                t.setHours(h, m, 0, 0);
                const diffMin = (now - t) / 60000; // positive if now after time
                if (diffMin >= -windowBeforeMin && diffMin <= windowAfterMin && !fired.includes(prayer)) {
                    console.log(`🛟 Watchdog triggering adhan for ${prayer}. diff=${diffMin.toFixed(2)} min`);
                    triggered = true;
                    fired.push(prayer);
                    playAdhan(prayer);
                }
            });
            if (triggered) {
                chrome.storage.local.set({ firedPrayers: fired, firedPrayersDate: today });
            }
        });
        return;
    }

    if (alarm.name.startsWith('prayer_')) {
        const prayer = alarm.name.split('_')[1];
        console.log(`📿 Prayer alarm detected for: ${prayer}`);
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: 'Adhan Time',
            message: `It's time for ${prayer} prayer.`
        }, (notificationId) => {
            console.log('📢 Notification created:', notificationId);
        });
        
        // Check if audio enabled
        chrome.storage.local.get(['playAudio'], function(result) {
            console.log('🔊 playAudio setting:', result.playAudio);
            if (result.playAudio) {
                console.log('▶️  Calling playAdhan()...');
                playAdhan(prayer);
            } else {
                console.log('⏸️  Audio playback disabled in settings');
            }
        });

        // Mark this prayer as fired for today to avoid duplicate watchdog triggers
        const today = new Date().toDateString();
        chrome.storage.local.get(['firedPrayers', 'firedPrayersDate'], (r) => {
            let fired = Array.isArray(r.firedPrayers) && r.firedPrayersDate === today ? r.firedPrayers : [];
            if (!fired.includes(prayer)) {
                fired.push(prayer);
                chrome.storage.local.set({ firedPrayers: fired, firedPrayersDate: today });
            }
        });
    }
});

async function playAdhan(prayer) {
    console.log(`\n🎵 playAdhan() called for: ${prayer}`);
    
    // Store current prayer name for popup restoration
    chrome.storage.local.set({ currentPrayer: prayer });
    
    // Ensure offscreen document exists
    console.log('📄 Checking offscreen document...');
    await setupOffscreenDocument();
    
    // Send play message to offscreen document
    try {
        console.log('📨 Sending playAdhan message to offscreen...');
        const response = await chrome.runtime.sendMessage({ action: 'playAdhan', prayer: prayer });
        console.log('✅ Response from offscreen:', response);
    } catch (error) {
        console.error('❌ Error sending play message:', error);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'reschedule') {
        console.log('📨 Reschedule request received');
        schedulePrayers();
        sendResponse({ success: true });
        return false;
    }
    // Handle test play adhan from popup/options
    else if (message.action === 'testPlayAdhan' || message.action === 'playAdhan') {
        console.log('🎵 Play adhan request received from:', sender.url || 'unknown');
        playAdhan(message.prayer || 'Test');
        sendResponse({ success: true });
        return false;
    }
    // Route audio control messages to offscreen document
    else if (message.action === 'pauseAdhan' || message.action === 'resumeAdhan' || message.action === 'getAudioState' || message.action === 'stopAdhan') {
        chrome.runtime.sendMessage(message, sendResponse);
        return true; // Keep channel open for async response
    }
    // Broadcast adhan state changes to all extension contexts (popup, etc.)
    else if (message.action === 'adhanStarted' || message.action === 'adhanEnded') {
        if (message.action === 'adhanEnded') {
            // Clear current prayer when adhan ends
            chrome.storage.local.remove('currentPrayer');
        }
        chrome.runtime.sendMessage(message).catch(() => {}); // Broadcast to popup if open, ignore errors
        sendResponse({ received: true });
        return false;
    }
    // Default: no response needed
    return false;
});

// ===== Hadith API relay (keep key out of frontend) =====
// Using hadith.gading.dev - free, no API key required

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'fetchHadith') {
        // Use hadith.gading.dev books endpoint which lists all hadiths
        const book = request.book || 'bukhari';
        const apiUrl = `https://api.hadith.gading.dev/books/${book}?range=1-50`;
        
        console.log('Fetching hadith from:', apiUrl);
        
        fetch(apiUrl)
            .then(async res => {
                console.log('Hadith API response status:', res.status);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                const data = await res.json();
                console.log('Hadith API data:', data);
                
                // The response should have data.data.hadiths array
                if (!data || !data.data || !data.data.hadiths || data.data.hadiths.length === 0) {
                    throw new Error('No hadiths in response');
                }
                
                // Pick a random hadith from the returned list
                const hadiths = data.data.hadiths;
                const randomIndex = Math.floor(Math.random() * hadiths.length);
                const selectedHadith = hadiths[randomIndex];
                
                console.log('Selected hadith:', selectedHadith);
                console.log('Hadith contents:', selectedHadith?.contents);
                
                sendResponse({ success: true, data: { data: { hadiths: [selectedHadith] } } });
            })
            .catch(err => {
                console.error('Hadith fetch error:', err);
                sendResponse({ success: false, error: err.message });
            });
        
        // Return true to indicate async response
        return true;
    }
});