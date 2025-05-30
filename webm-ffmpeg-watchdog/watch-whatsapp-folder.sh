#!/bin/bash

# watch-whatsapp-folder.sh - Monitor folder for .webm files and trigger conversion
# Uses inotifywait to watch for new .webm files

# Watchdog folder (must match installer.sh)
watch_dir="/home/$USER/Music/WhatsappMessages"

logfile="/tmp/watchdog.log"

# Check if folder exists
if [ ! -d "$watch_dir" ]; then
    echo "Error: Watchdog folder $watch_dir does not exist at $(date)" >> "$logfile"
    exit 1
fi

echo "Watchdog started at $(date)" >> "$logfile"

inotifywait -m -e close_write,moved_to --format '%f' "$watch_dir" | while read -r filename; do

    echo "Event for file: $filename at $(date)" >> "$logfile"

    # Temporäre Swap-Dateien ignorieren
    if [[ "$filename" == *.crswap ]]; then
        echo "Error: File $filename ignored (.crswap) at $(date)" >> "$logfile"
        continue
    # Nur .webm Dateien verarbeiten
    if [[ "$filename" != *.webm ]]; then
        echo "Error: File $filename ignored (not a .webm) at $(date)" >> "$logfile"
        continue
    fi

    full_path="${watch_dir}/${filename}"

    # Kleine Verzögerung, um sicherzugehen, dass Datei stabil ist
    sleep 2

    # Prüfen, ob Datei existiert und lesbar
    if [[ ! -f "$full_path" ]]; then
        echo "Error: File $full_path not found at $(date)" >> "$logfile"
        continue
    fi

    # Aufrufolder-shdog-Skripts
    echo "Converting $full_path at $(date)" >> "$logfile"
    /usr/local/bin/ffmpeg-converter.sh "$full_path"

    # Wenn Konvertierung erfolgreich, Quell-Datei löschen
    if [[ $? -eq 0 ]]; then
        rm -f "$full_path"
        echo "Deleted source file $full_path at $(date)" >> "$logfile"
    else
        echo "Error converting $full_path at $(date)" >> "$logfile"
    fi

done