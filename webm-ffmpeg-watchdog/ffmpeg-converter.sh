
#!/bin/bash

# ffmpeg-converter.sh
# Convert WhatsApp webm voice note to mp3 with proper filename and chown to 'maksim'

input_file="$1"
logfile="/tmp/watchdog.log"
target_user="maksim"

if [[ -z "$input_file" ]]; then
    echo "No input file specified." >&2
    exit 1
fi

if [[ ! -f "$input_file" ]]; then
    echo "Input file does not exist: $input_file" >&2
    exit 1
fi

dir=$(dirname "$input_file")
date_part=$(date +"%Y-%m-%d")
time_part=$(date +"%H.%M.%S")
output_file="${dir}/WhatsApp Ptt ${date_part} at ${time_part}.mp3"

echo "[$(date)] Starting conversion of $input_file to $output_file" >> "$logfile"

ffmpeg -i "$input_file" -vn -b:a 64k -codec:a libmp3lame -y "$output_file" >> "$logfile" 2>&1
if [[ $? -eq 0 ]]; then
    echo "[$(date)] Conversion successful: $output_file" >> "$logfile"
    rm -f "$input_file"
    chown "$target_user":"$target_user" "$output_file"
    echo "[$(date)] Deleted source and changed owner to $target_user" >> "$logfile"
    exit 0
else
    echo "[$(date)] Conversion failed for $input_file" >> "$logfile"
    exit 2
fi