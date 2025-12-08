let audioElement = null;
let isPlaying = false;

// Initialize audio element immediately when document loads
document.addEventListener('DOMContentLoaded', () => {
    audioElement = document.getElementById('adhanAudio');
    if (!audioElement) {
        console.error('Audio element not found!');
        return;
    }

    // Set correct src for extension
    audioElement.src = chrome.runtime.getURL('adhan.mp3');

    // Preload audio
    audioElement.load();
    
    // Add ended listener
    audioElement.addEventListener('ended', () => {
        isPlaying = false;
        chrome.runtime.sendMessage({ action: 'adhanEnded' }).catch(() => {});
    });
    
    // Add error listener
    audioElement.addEventListener('error', (e) => {
        console.error('Audio load error:', e);
        console.error('Audio element error:', audioElement.error);
    });
    
    console.log('Offscreen audio initialized, ready to play');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Lazy init if DOMContentLoaded hasn't fired yet
    if (!audioElement) {
        audioElement = document.getElementById('adhanAudio');
        if (audioElement) {
            audioElement.src = chrome.runtime.getURL('adhan.mp3');
            audioElement.load();
        }
    }
    
    if (!audioElement) {
        console.error('Audio element still not available');
        sendResponse({ error: 'Audio element not found' });
        return true;
    }
    
    if (message.action === 'playAdhan') {
        console.log('Received playAdhan message for:', message.prayer);
        audioElement.currentTime = 0;
        audioElement.play().then(() => {
            console.log('Audio playing successfully');
            isPlaying = true;
            // Notify that audio started
            chrome.runtime.sendMessage({ action: 'adhanStarted', prayer: message.prayer || 'Adhan' }).catch(() => {});
            sendResponse({ success: true });
        }).catch(err => {
            console.error('Error playing adhan:', err);
            sendResponse({ error: err.message });
        });
        return true; // Keep channel open for async promise
    }
    
    else if (message.action === 'pauseAdhan') {
        audioElement.pause();
        isPlaying = false;
        sendResponse({ paused: true });
        return false;
    }
    
    else if (message.action === 'resumeAdhan') {
        audioElement.play().then(() => {
            isPlaying = true;
            sendResponse({ resumed: true });
        }).catch(err => {
            console.error('Error resuming adhan:', err);
            sendResponse({ error: err.message });
        });
        return true; // Keep channel open for async promise
    }
    
    else if (message.action === 'stopAdhan') {
        audioElement.pause();
        audioElement.currentTime = 0;
        isPlaying = false;
        console.log('Audio stopped and reset');
        chrome.runtime.sendMessage({ action: 'adhanEnded' }).catch(() => {});
        sendResponse({ stopped: true });
        return false;
    }
    
    else if (message.action === 'getAudioState') {
        sendResponse({ 
            isPlaying: isPlaying && !audioElement.paused,
            currentTime: audioElement.currentTime,
            duration: audioElement.duration,
            readyState: audioElement.readyState,
            src: audioElement.src
        });
        return false;
    }
    
    return false; // No async response needed for unknown actions
});