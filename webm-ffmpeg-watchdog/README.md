
# webm-ffmpeg-watchdog

This tool provides a simple and robust solution for automatically converting `.webm` audio files to `.ogg` format—making them suitable for sharing via WhatsApp. It uses `inotifywait` to monitor a directory and automatically converts new files as they appear.

## ✨ Features

- Watches a specified folder for new `.webm` files
- Converts them to `.ogg` using `ffmpeg`
- Deletes the original file after successful conversion
- Skips partial `.crswap` files created by browsers or editors
- Designed for use on Linux with `systemd` integration

## 📁 Folder Structure

This tool consists of two main scripts:

- `watch-whatsapp-folder.sh`: The watchdog that listens for new `.webm` files
- `ffmpeg-converter.sh`: A lightweight wrapper around `ffmpeg` to perform the conversion

## 🔧 Installation

1. Copy the scripts to `/usr/local/bin/` and make them executable:

   ```bash
   sudo cp watch-whatsapp-folder.sh /usr/local/bin/
   sudo cp ffmpeg-converter.sh /usr/local/bin/
   sudo chmod +x /usr/local/bin/*.sh
   ```

2. Create and enable the `systemd` service:

   ```bash
   sudo cp whatsapp-converter.service /etc/systemd/system/
   sudo systemctl daemon-reexec
   sudo systemctl daemon-reload
   sudo systemctl enable whatsapp-converter.service
   sudo systemctl start whatsapp-converter.service
   ```

## 📌 Default Watch Path

By default, the script monitors:

```
~/Music/WhatsappMessages/
```

You can change this path in the `watch-whatsapp-folder.sh` file.

## 🧠 Concept: Upstream Integration

This tool is intended to be part of a larger audio processing pipeline. For example:

- A frontend recording system or browser plugin records high-quality audio and saves it as `.webm`
- The `.webm` files are written to the watched folder (e.g., via a Node.js or React-based app)
- This tool then automatically converts them to `.ogg`
- The `.ogg` files are ready for direct upload to WhatsApp

This architecture ensures clean audio input, seamless conversion, and minimal manual handling.

## 📥 Output Format

Converted files are saved in the **same folder** as the original, with the extension `.ogg`. The original `.webm` files are deleted upon successful conversion.

**Example:**

```
Input:  message123_whatsapp_voice.webm
Output: message123_whatsapp_voice.ogg
```

## 🛠️ Requirements

- `ffmpeg`
- `inotify-tools`
- Linux with `systemd`

Install dependencies (Debian/Ubuntu):

```bash
sudo apt install ffmpeg inotify-tools
```

## 📜 License

MIT License — feel free to use, share, and improve.
