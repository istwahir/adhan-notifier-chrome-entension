document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('settingsForm');
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const playAudioCheckbox = document.getElementById('playAudio');

    // Load settings
    chrome.storage.local.get(['enabledPrayers', 'playAudio'], function(result) {
        const enabled = result.enabledPrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        prayers.forEach(prayer => {
            const checkbox = document.getElementById(prayer);
            if (enabled.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
        if (result.playAudio) {
            playAudioCheckbox.checked = true;
        }
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const enabledPrayers = [];
        prayers.forEach(prayer => {
            const checkbox = document.getElementById(prayer);
            if (checkbox.checked) {
                enabledPrayers.push(checkbox.value);
            }
        });
        const playAudio = playAudioCheckbox.checked;
        chrome.storage.local.set({
            enabledPrayers: enabledPrayers,
            playAudio: playAudio
        }, function() {
            alert('Settings saved!');
            // Reschedule prayers
            chrome.runtime.sendMessage({ action: 'reschedule' });
        });
    });
});