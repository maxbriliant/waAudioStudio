#!/bin/bash

# ffmpeg-converter.sh - Convert .webm files to .ogg for WhatsApp
# target_user is set by installer.sh

# Default target_user (will be overwritten by installer)
target_user=""

# Watchdog folder
WATCHDOG_FOLDER="/home/$target_user/Music/WhatsappMessages"

# Check if input file is provided
if [ -z "$1" ]; then
    echo "Error: No input file provided"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${INPUT_FILE%.webm}.ogg"

# Convert .webm to .ogg using ffmpeg
ffmpeg -i "$INPUT_FILE" -c:a libopus -b:a 128k "$OUTPUT_FILE" && rm "$INPUT_FILE"

if [ $? -eq 0 ]; then
    echo "Converted $INPUT_FILE to $OUTPUT_FILE"
else
    echo "Error converting $INPUT_FILE"
    exit 1
fi