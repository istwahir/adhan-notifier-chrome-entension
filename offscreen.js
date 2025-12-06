chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'playAdhan') {
        const audio = document.getElementById('adhanAudio');
        audio.currentTime = 0;
        audio.play();
    }
});