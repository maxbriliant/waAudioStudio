#!/bin/bash

# Ordner, der überwacht wird
watch_dir="/home/maksim/Music/WhatsappMessages"

logfile="/tmp/watchdog.log"

echo "Watchdog started at $(date)" >> "$logfile"

inotifywait -m -e close_write,moved_to --format '%f' "$watch_dir" | while read -r filename; do

    echo "Event for file: $filename at $(date)" >> "$logfile"

    # Temporäre Swap-Dateien ignorieren
    if [[ "$filename" == *.crswap ]]; then
        echo "File $filename ignored (.crswap) at $(date)" >> "$logfile"
        continue
    fi

    # Nur .webm Dateien verarbeiten
    if [[ "$filename" != *.webm ]]; then
        echo "File $filename ignored (not .webm) at $(date)" >> "$logfile"
        continue
    fi

    full_path="${watch_dir}/${filename}"

    # Kleine Verzögerung, um sicherzugehen, dass Datei stabil ist
    sleep 2

    # Prüfen, ob Datei existiert und lesbar
    if [[ ! -f "$full_path" ]]; then
        echo "File $full_path no longer exists at $(date)" >> "$logfile"
        continue
    fi

    # Aufruf des Konverter-Skripts
    echo "Converting $full_path at $(date)" >> "$logfile"
    /usr/local/bin/ffmpeg-converter.sh "$full_path"

    # Wenn Konvertierung erfolgreich, Quell-Datei löschen
    if [[ $? -eq 0 ]]; then
        rm -f "$full_path"
        echo "Deleted source file $full_path at $(date)" >> "$logfile"
    else
        echo "Conversion failed for $full_path at $(date)" >> "$logfile"
    fi

done
