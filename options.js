document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('settingsForm');
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const playAudioCheckbox = document.getElementById('playAudio');
    const hadithApiKeyInput = document.getElementById('hadithApiKey');

    // Load settings
    chrome.storage.local.get(['enabledPrayers', 'playAudio', 'hadithApiKey'], function(result) {
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
        // Avoid logging API key; just populate the masked field if present
        if (hadithApiKeyInput && typeof result.hadithApiKey === 'string' && result.hadithApiKey.length > 0) {
            hadithApiKeyInput.value = result.hadithApiKey;
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
        const hadithApiKey = hadithApiKeyInput ? hadithApiKeyInput.value.trim() : '';
        // Store locally (not synced). Do not log or expose the key.
        chrome.storage.local.set({
            enabledPrayers: enabledPrayers,
            playAudio: playAudio,
            hadithApiKey: hadithApiKey
        }, function() {
            alert('Settings saved!');
            // Reschedule prayers
            chrome.runtime.sendMessage({ action: 'reschedule' });
        });
    });
});