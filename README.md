# Adhan Notifier - Chrome Extension

A lightweight Chrome extension that notifies users at Islamic prayer times (Adhan) based on their location.

## Features

- **Accurate Prayer Times**: Fetches daily prayer times using the Aladhan API
- **Location-Based**: Supports both manual location input and automatic geolocation
- **Browser Notifications**: Native Chrome notifications at each prayer time
- **Customizable Settings**: Enable/disable specific prayers and audio playback
- **Optional Audio**: Play Adhan audio when notifications trigger
- **Hadith of the Day**: Displays a random Islamic Hadith daily from HadithAPI
- **Privacy-Focused**: All data stored locally, no external tracking

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your extensions list

## Setup

1. Click the extension icon in the Chrome toolbar
2. Enter your city and country, or click "Use Current Location"
3. Prayer times will be fetched and displayed
4. The extension will automatically schedule notifications for enabled prayers

## Settings

Access settings by:
- Right-clicking the extension icon and selecting "Options"
- Or navigating to `chrome://extensions/`, finding Adhan Notifier, and clicking "Details" > "Extension options"

### Available Settings:
- **Enabled Prayers**: Check/uncheck to enable notifications for specific prayers (Fajr, Dhuhr, Asr, Maghrib, Isha)
- **Play Adhan Audio**: Toggle to enable/disable audio playback with notifications

## Files Structure

```
adhan-extension/
├── manifest.json          # Extension manifest
├── popup.html            # Main popup interface
├── popup.js              # Popup functionality
├── background.js         # Service worker for scheduling
├── options.html          # Settings page
├── options.js            # Settings functionality
├── offscreen.html        # Audio playback document
├── offscreen.js          # Audio handling
├── adhan.mp3             # Adhan audio file (add manually)
├── icon16.png            # 16x16 extension icon
├── icon48.png            # 48x48 extension icon
└── icon128.png           # 128x128 extension icon
```

## Permissions

The extension requires the following permissions:
- `notifications`: To display prayer time notifications
- `geolocation`: To get user's location for prayer times
- `storage`: To save settings and prayer times locally
- `alarms`: To schedule notifications at specific times
- `offscreen`: To play audio in the background

## API Usage

Uses the [Aladhan API](https://aladhan.com/prayer-times-api) for prayer time calculations:
- By city/country: `https://api.aladhan.com/v1/timingsByCity`
- By coordinates: `https://api.aladhan.com/v1/timings`

Uses the [HadithAPI](https://hadithapi.com/) for daily Hadith:
- Random Hadith: `https://hadithapi.com/api/hadiths/random`

## Technical Details

- **Manifest Version**: 3 (Chrome Extension Manifest V3)
- **Background**: Service worker architecture
- **Storage**: Chrome local storage for settings and data
- **Notifications**: Chrome notifications API
- **Audio**: Offscreen document for background audio playback

## Privacy

- No user data is transmitted or stored externally
- Location data is only used for prayer time calculations
- All settings and prayer times are stored locally in Chrome storage
- API calls are made directly from the user's browser

## Requirements

- Google Chrome browser
- Internet connection for initial setup and API calls
- Location permission for automatic location detection

## Contributing

Feel free to submit issues or pull requests for improvements.

## License

This project is open source. Please check individual file licenses if applicable.