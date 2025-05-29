# WhatsApp Audio Studio

🎤 **The audio recorder that actually makes WhatsApp voice messages bearable**

## Warum dieses Tool?

**Die Realität:** WhatsApp's eingebauter Audio-Recorder ist... nun ja, sagen wir mal "optimierungsfähig". Schlechte Qualität, nervige Bedienung, und wenn man mal eben schnell mehrere Voice Messages aufnehmen will, wird's zur Qual.

**Die Lösung:** Ein sauberer Browser-basierter Recorder, der hochwertige WebM-Dateien erstellt - gekoppelt mit einem cleveren FFmpeg-Watchdog, der im Hintergrund alles automatisch für WhatsApp optimiert. Einmal einrichten, dann einfach nur noch aufnehmen und verschicken.

**Das Ergebnis:** Professionelle Audio-Qualität für WhatsApp, ohne Drama. 🎯

## Was kann das Ding?

✅ **Saubere Aufnahmen**: WebM Opus mit 320kbps - klingt einfach besser  
✅ **Nummerierte Dateien**: 1.webm, 2.webm, 3.webm... keine Verwirrung mehr  
✅ **Fire & Forget**: Watchdog macht den Rest automatisch  
✅ **Überlebt Neustarts**: Zähler und Einstellungen bleiben erhalten  
✅ **Setup einmal, läuft immer**: 7 Tage Directory-Cache  
✅ **Läuft überall**: Windows, macOS, Linux  
✅ **Echter System-Service**: Läuft im Hintergrund, auch nach Reboot

## Wie ist das aufgebaut?

```
whatsapp-audio-studio/
├── src/                    # React-App für die Aufnahmen
├── public/                 # Statische Files
├── webm-ffmpeg-watchdog/   # Der clevere FFmpeg-Automat
│   ├── README.md          # Ausführliche Setup-Anleitung
│   ├── watch-whatsapp-folder.sh    # inotify Watchdog
│   ├── ffmpeg-converter.sh         # FFmpeg Wrapper
│   └── whatsapp-converter.service  # systemd Service
├── screenshot.png         # Screenshot (falls jemand sehen will)
└── package.json          # Dependencies
```

## Loslegen

### App installieren

```bash
git clone https://github.com/yourusername/whatsapp-audio-studio.git
cd whatsapp-audio-studio
npm install
npm start
```

### Browser einrichten
* `http://localhost:3000` öffnen
* Mikrofon-Berechtigung geben (einmal)
* Ordner auswählen wo die Audio-Files hin sollen

### Den Watchdog scharf stellen (Linux)

Das ist der Teil, der die ganze Magie möglich macht:

```bash
# In den Watchdog-Ordner
cd webm-ffmpeg-watchdog

# System-Dependencies (einmalig)
sudo apt install ffmpeg inotify-tools

# Watchdog-Scripts installieren
sudo cp watch-whatsapp-folder.sh /usr/local/bin/
sudo cp ffmpeg-converter.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/*.sh

# Als System-Service einrichten
sudo cp whatsapp-converter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-converter.service
sudo systemctl start whatsapp-converter.service
```

**Prüfen ob alles läuft:**
```bash
sudo systemctl status whatsapp-converter.service
```

Der komplette Setup-Guide steht in `webm-ffmpeg-watchdog/README.md` - da ist alles nochmal detailliert erklärt.

## So funktioniert der Workflow

### Frontend (Die Web-App)
1. **Aufnehmen** → Erstellt nummerierte .webm Files
2. **Sauber halten** → Nur Audio-Files, kein Müll
3. **Durchnummerieren** → 1, 2, 3... logisch und simpel

### Backend (Der FFmpeg-Watchdog)
1. **Als Service laufen** → systemctl macht das automatisch
2. **Ordner überwachen** → `inotifywait` passt auf neue .webm Files auf
3. **Konvertieren** → FFmpeg macht daraus WhatsApp-kompatible .ogg Files
4. **Aufräumen** → .webm Files werden nach erfolgreicher Konvertierung gelöscht
5. **Fertig** → Nur noch perfekte .ogg Files für WhatsApp

### Standard-Ordner
```
~/Music/WhatsappMessages/
```
*Kannst du in den Watchdog-Scripts ändern, wenn du willst*

## Warum diese Architektur?

**Getrennte Verantwortlichkeiten - das funktioniert einfach:**
* **Web-App**: Macht nur Aufnahmen, macht sie gut
* **Watchdog-Service**: Macht nur Konvertierung, macht sie automatisch
* **Sauberer Ordner**: Immer aufgeräumt, immer bereit
* **Zero Maintenance**: Einmal setup, dann vergessen

**File-Flow:**
```
Aufnahme:    1.webm, 2.webm, 3.webm... (von der App)
Ergebnis:    1.ogg, 2.ogg, 3.ogg...   (vom Watchdog)
```

**System-Integration die funktioniert:**
```bash
# Watchdog läuft automatisch
systemctl status whatsapp-converter.service

# Logs anschauen (falls mal was ist)
journalctl -u whatsapp-converter.service -f
```

## Technische Details (für die Nerds)

### Audio-Pipeline
* **Input**: WebM Opus @ 320kbps, 48kHz, Stereo (Browser-Quality)
* **Output**: OGG Opus optimiert für WhatsApp mit faststart
* **Konvertierung**: Lossless transcoding, optimale Kompression

### System-Integration
* **Browser-Storage**: localStorage für Zähler + Directory-Config
* **File System API**: Direkte File-Erstellung im ausgewählten Ordner
* **Keine externen Dependencies**: Pure Browser-APIs
* **Watchdog**: inotify-basiertes Monitoring mit systemd
* **Background Processing**: System-Daemon, überlebt Reboots

### Was du brauchst
* **Web-App**: Moderner Browser mit File System Access API
* **Watchdog**: Linux mit systemd, ffmpeg, inotify-tools

## Benutzung (Der Easy Way)

1. **Watchdog setup** (einmal):
   ```bash
   cd webm-ffmpeg-watchdog && sudo ./install.sh
   ```

2. **App starten**: `npm start`

3. **Directory wählen**: z.B. ~/Music/WhatsappMessages/

4. **Aufnehmen**: Klicken, sprechen, fertig - nummerierte .webm Files

5. **Magic happens**: Watchdog konvertiert automatisch zu .ogg

6. **WhatsApp**: .ogg Files einfach hochladen, perfekte Qualität

## Service Management (Falls mal was ist)

```bash
# Watchdog starten/stoppen
sudo systemctl start whatsapp-converter.service
sudo systemctl stop whatsapp-converter.service

# Auto-Start ein/aus
sudo systemctl enable whatsapp-converter.service
sudo systemctl disable whatsapp-converter.service

# Live-Logs anschauen
journalctl -u whatsapp-converter.service -f
```

## Warum das so gut funktioniert

* **Entkoppeltes Design**: Web-App und File-Processing kennen sich nicht
* **Echte System-Integration**: Läuft als ordentlicher Linux-Service
* **Vollautomatisch**: Null manuelle Arbeit nach dem Setup
* **Robust**: systemd sorgt dafür, dass der Service immer läuft
* **Sauberer Workflow**: Browser → WebM → Watchdog → OGG → WhatsApp

**Kurz gesagt:** Einmal einrichten, dann nie wieder dran denken müssen. Audio aufnehmen, WhatsApp freut sich. 🚀
