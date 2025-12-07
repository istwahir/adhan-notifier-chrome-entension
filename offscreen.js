let audioElement = null;
let isPlaying = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    audioElement = audioElement || document.getElementById('adhanAudio');
    
    if (message.action === 'playAdhan') {
        audioElement.currentTime = 0;
        audioElement.play().then(() => {
            isPlaying = true;
            // Notify that audio started
            chrome.runtime.sendMessage({ action: 'adhanStarted', prayer: message.prayer || 'Adhan' });
        }).catch(err => console.error('Error playing adhan:', err));
    }
    
    else if (message.action === 'pauseAdhan') {
        audioElement.pause();
        isPlaying = false;
        sendResponse({ paused: true });
    }
    
    else if (message.action === 'resumeAdhan') {
        audioElement.play().then(() => {
            isPlaying = true;
            sendResponse({ resumed: true });
        }).catch(err => {
            console.error('Error resuming adhan:', err);
            sendResponse({ error: err.message });
        });
    }
    
    else if (message.action === 'getAudioState') {
        sendResponse({ 
            isPlaying: isPlaying && !audioElement.paused,
            currentTime: audioElement.currentTime,
            duration: audioElement.duration
        });
    }
    
    return true; // Keep channel open for async response
});

// Listen for audio end
if (audioElement) {
    audioElement.addEventListener('ended', () => {
        isPlaying = false;
        chrome.runtime.sendMessage({ action: 'adhanEnded' });
    });
}