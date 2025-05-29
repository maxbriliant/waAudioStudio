import React, { useState, useRef, useEffect, useCallback } from "react";

export default function WhatsAppAudioRecorder() {
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [workingDirectory, setWorkingDirectory] = useState(null);
  const [supportedFormats, setSupportedFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [platformInfo, setPlatformInfo] = useState({ os: 'unknown' });
  const [setupStatus, setSetupStatus] = useState({
    isConfigured: false,
    directoryName: null,
    lastVerified: null,
    platformOS: null
  });
  const [fileCounter, setFileCounter] = useState(1);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const debugLog = (message, data = null) => {
    console.log(`🎤 ${message}`, data);
  };

  // STRATEGIC: Simplified persistent state management
  const STORAGE_KEYS = {
    directory: 'whatsapp-audio-studio-directory-config',
    counter: 'whatsapp-audio-studio-file-counter'
  };

  const getNextFileNumber = () => {
    try {
      const savedCounter = localStorage.getItem(STORAGE_KEYS.counter);
      const currentCounter = savedCounter ? parseInt(savedCounter, 10) : 1;
      const nextCounter = currentCounter;
      
      localStorage.setItem(STORAGE_KEYS.counter, (currentCounter + 1).toString());
      setFileCounter(nextCounter);
      debugLog('📊 File counter', { current: nextCounter, next: currentCounter + 1 });
      return nextCounter;
    } catch (err) {
      debugLog('⚠️ Counter management failed, using fallback', err.message);
      return Date.now();
    }
  };

  const resetFileCounter = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.counter, '1');
      setFileCounter(1);
      debugLog('🔄 File counter reset to 1');
    } catch (err) {
      debugLog('⚠️ Failed to reset counter', err.message);
    }
  };

  const saveDirectoryConfig = (directoryHandle, directoryName) => {
    try {
      const config = {
        isConfigured: true,
        directoryName: directoryName,
        lastVerified: Date.now(),
        platformOS: platformInfo.os,
        version: '2.0'
      };
      localStorage.setItem(STORAGE_KEYS.directory, JSON.stringify(config));
      setSetupStatus(config);
      debugLog('✅ Directory config saved', config);
    } catch (err) {
      debugLog('⚠️ Failed to save directory config', err.message);
    }
  };

  const loadDirectoryConfig = () => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEYS.directory);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        if (config.lastVerified > weekAgo && config.platformOS === platformInfo.os) {
          setSetupStatus(config);
          debugLog('✅ Directory config restored', config);
          return config;
        } else {
          debugLog('⚠️ Directory config expired or platform changed');
          clearDirectoryConfig();
        }
      }
    } catch (err) {
      debugLog('⚠️ Failed to load directory config', err.message);
      clearDirectoryConfig();
    }
    return null;
  };

  const clearDirectoryConfig = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.directory);
      setSetupStatus({
        isConfigured: false,
        directoryName: null,
        lastVerified: null,
        platformOS: null
      });
      debugLog('🧹 Directory config cleared');
    } catch (err) {
      debugLog('⚠️ Failed to clear directory config', err.message);
    }
  };

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    let os = 'linux';
    if (platform.includes('win') || userAgent.includes('windows')) {
      os = 'windows';
    } else if (platform.includes('mac') || userAgent.includes('mac')) {
      os = 'macos';
    }
    
    const info = { os };
    setPlatformInfo(info);
    debugLog('✅ Platform detected', info);
    return info;
  };

  const detectSupportedFormats = () => {
    const formats = [
      { mimeType: 'audio/webm; codecs=opus', name: 'WebM Opus', priority: 1 },
      { mimeType: 'audio/webm', name: 'WebM', priority: 2 },
      { mimeType: 'audio/ogg; codecs=opus', name: 'OGG Opus', priority: 3 },
      { mimeType: 'audio/ogg', name: 'OGG', priority: 4 },
      { mimeType: 'audio/mp4', name: 'MP4', priority: 5 }
    ];

    const supported = formats.filter(format => 
      MediaRecorder.isTypeSupported(format.mimeType)
    ).sort((a, b) => a.priority - b.priority);

    setSupportedFormats(supported);
    
    if (supported.length > 0) {
      setSelectedFormat(supported[0]);
      debugLog('✅ Audio formats detected', {
        supported: supported.map(f => f.name),
        selected: supported[0].name
      });
    } else {
      setError('No supported audio recording formats found');
      debugLog('❌ No MediaRecorder support detected');
    }

    return supported;
  };

  // STRATEGIC: Simplified directory setup for watchdog integration
  const setupWorkingDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
        setWorkingDirectory(dirHandle);
        
        const platform = detectPlatform();
        
        // Create simple README for watchdog setup
        const readme = `# WhatsApp Audio Studio - Watchdog Integration

## ✅ Directory Setup Complete
**Directory:** ${dirHandle.name}  
**Platform:** ${platform.os.charAt(0).toUpperCase() + platform.os.slice(1)}  
**Setup Date:** ${new Date().toLocaleString()}  
**Mode:** External FFmpeg Watchdog Integration  

## How it works:
1. Record audio in the web app
2. App creates numbered .webm files (1.webm, 2.webm, 3.webm...)
3. Your external watchdog processes these files with FFmpeg
4. Watchdog creates WhatsApp-compatible .ogg files
5. Watchdog cleans up .webm files after processing

## File Pattern:
- **Input:** 1.webm, 2.webm, 3.webm, ... (created by web app)
- **Output:** 1.ogg, 2.ogg, 3.ogg, ... (created by your watchdog)
- **Clean:** Only .ogg files remain after processing

## Watchdog Integration Notes:
- App only creates .webm files with simple numbered names
- No scripts or temporary files generated by the app
- Clean directory structure maintained by external watchdog
- Perfect for automated FFmpeg processing workflows

## WhatsApp Compatibility:
✅ Voice messages: Your watchdog creates .ogg files optimized for WhatsApp  
✅ Professional quality: External FFmpeg ensures perfect compatibility  
✅ Clean workflow: Automated processing with minimal file clutter  

## Counter Management:
🔢 **File Counter:** Persisted across browser sessions  
🔄 **Reset Option:** Available in app to restart from 1  
🧠 **Smart Caching:** Directory setting remembered for 7 days  

Perfect integration with external automation tools!`;

        const readmeBlob = new Blob([readme], { type: 'text/plain' });
        const readmeHandle = await dirHandle.getFileHandle('README.md', { create: true });
        const readmeWritable = await readmeHandle.createWritable();
        await readmeWritable.write(readmeBlob);
        await readmeWritable.close();
        
        // Save configuration
        saveDirectoryConfig(dirHandle, dirHandle.name);
        
        debugLog('✅ Simplified directory setup complete', {
          platform: platform.os,
          directory: dirHandle.name,
          mode: 'watchdog-integration'
        });
        
        return true;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        debugLog('⚠️ Directory setup declined', err.message);
        setError('Directory access required for audio output');
      }
      return false;
    }
  };

  const restoreWorkingDirectory = async () => {
    if (!setupStatus.isConfigured) return false;
    
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
        
        setWorkingDirectory(dirHandle);
        saveDirectoryConfig(dirHandle, dirHandle.name);
        
        debugLog('✅ Working directory restored', {
          directory: dirHandle.name,
          cached: true
        });
        
        return true;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        debugLog('⚠️ Failed to restore working directory', err.message);
      }
    }
    return false;
  };

  const checkAndRequestPermissions = async () => {
    try {
      setPermissionStatus('checking');
      
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        } 
      });
      
      debugLog('✅ Microphone access granted');
      testStream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      
      // Initialize after permission granted
      detectSupportedFormats();
      const platform = detectPlatform();
      
      // Load cached directory configuration
      const cachedConfig = loadDirectoryConfig();
      if (cachedConfig && cachedConfig.isConfigured) {
        debugLog('🧠 Directory configuration remembered', {
          directory: cachedConfig.directoryName,
          platform: cachedConfig.platformOS
        });
      }
      
      return true;
      
    } catch (err) {
      debugLog('❌ Permissions denied', err.message);
      setPermissionStatus('denied');
      setError(`Microphone required: ${err.message}`);
      return false;
    }
  };

  useEffect(() => {
    checkAndRequestPermissions();
  }, []);

  const cleanup = useCallback(() => {
    [timerRef, animationRef].forEach(ref => {
      if (ref.current) {
        ref === timerRef ? clearInterval(ref.current) : cancelAnimationFrame(ref.current);
        ref.current = null;
      }
    });
    
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try {
        mediaRecorderRef.current?.stop();
      } catch (e) {
        debugLog('⚠️ MediaRecorder cleanup', e.message);
      }
      mediaRecorderRef.current = null;
    }
    
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setAudioStream(null);
    }
    
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [isRecording]);

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current || !isRecording) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    const draw = () => {
      if (!isRecording) return;
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#f0f2f5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#25D366');
        gradient.addColorStop(0.5, '#128C7E');
        gradient.addColorStop(1, '#0d7377');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    draw();
  }, [isRecording]);

  // STRATEGIC: Pure audio recording with clean file output
  const startRecording = async () => {
    try {
      debugLog('🎬 Starting clean audio recording...');
      setError(null);
      cleanup();
      
      if (permissionStatus !== 'granted') {
        const granted = await checkAndRequestPermissions();
        if (!granted) return;
      }

      if (!selectedFormat) {
        setError('No supported recording format available');
        return;
      }

      if (!workingDirectory) {
        setError('Working directory required - please setup directory first');
        return;
      }

      // High-quality audio recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
          latency: 0.01
        }
      });
      
      streamRef.current = stream;
      setAudioStream(stream);

      // Audio visualization
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Use best supported format
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedFormat.mimeType,
        audioBitsPerSecond: 320000 // High quality for external processing
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.onstart = () => {
        debugLog('🎬 Recording started', { 
          format: selectedFormat.name,
          platform: platformInfo.os
        });
        setIsRecording(true);
        drawWaveform();
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        debugLog('⏹️ Saving recorded audio...');
        
        if (audioChunksRef.current.length > 0) {
          const rawBlob = new Blob(audioChunksRef.current, { 
            type: selectedFormat.mimeType 
          });
          
          try {
            const fileNumber = getNextFileNumber();
            await saveAudioFile(rawBlob, fileNumber);
            
          } catch (err) {
            debugLog('⚠️ Save failed', err.message);
            setError(`Failed to save audio: ${err.message}`);
          }
        } else {
          setError('No audio data captured');
        }
        
        audioChunksRef.current = [];
      };

      mediaRecorder.onerror = (event) => {
        debugLog('❌ Recording error', event.error);
        setError(`Recording failed: ${event.error?.message}`);
        cleanup();
      };

      mediaRecorder.start(50);
      
    } catch (err) {
      debugLog('💥 Recording failed', err);
      setError(`Failed to start: ${err.message}`);
      cleanup();
    }
  };

  const stopRecording = () => {
    debugLog('⏹️ Stopping recording...');
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setTimeout(cleanup, 1000);
  };

  // STRATEGIC: Clean file saving for watchdog processing
  const saveAudioFile = async (blob, fileNumber) => {
    if (!workingDirectory) {
      throw new Error('Working directory not available');
    }

    try {
      const filename = `${fileNumber}.webm`;
      
      // Write WebM file directly
      const fileHandle = await workingDirectory.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      // Create recording entry for UI
      const recording = {
        id: Date.now(),
        filename,
        fileNumber,
        duration: recordingTime,
        timestamp: new Date().toLocaleTimeString(),
        size: blob.size,
        format: selectedFormat.name,
        directory: workingDirectory.name,
        status: 'ready-for-watchdog'
      };
      
      setRecordings(prev => [...prev, recording]);
      debugLog(`✅ Audio file saved: ${filename}`, { 
        size: blob.size, 
        format: selectedFormat.name,
        watchdogReady: true
      });
      
    } catch (err) {
      debugLog('❌ File save failed', err.message);
      throw err;
    }
  };

  const removeRecording = (index) => {
    setRecordings(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getPlatformIcon = (os) => {
    switch (os) {
      case 'windows': return '🪟';
      case 'macos': return '🍎';
      case 'linux': return '🐧';
      default: return '💻';
    }
  };

  return (
    <div className="bg-[#ece5dd] min-h-screen p-4 space-y-4">
      {/* Clean header for watchdog mode */}
      <div className="bg-gradient-to-r from-[#075e54] via-[#128C7E] to-[#25D366] text-white p-6 rounded-lg shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎤</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Audio Studio</h1>
              <p className="text-sm opacity-90">Pure audio recorder + External FFmpeg watchdog integration</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">
              {permissionStatus === 'granted' ? '✅ Ready' : 
               permissionStatus === 'denied' ? '❌ Access Required' : '⏳ Initializing...'}
            </div>
            <div className="opacity-75 flex items-center space-x-2">
              <span>{getPlatformIcon(platformInfo.os)}</span>
              <span>{platformInfo.os} • {selectedFormat?.name || 'Detecting...'}</span>
            </div>
            {workingDirectory && (
              <div className="text-xs opacity-75">📁 {workingDirectory.name}</div>
            )}
          </div>
        </div>
      </div>

      {/* Platform & directory status */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-800 flex items-center space-x-2">
              <span>{getPlatformIcon(platformInfo.os)}</span>
              <span>Platform: {platformInfo.os.charAt(0).toUpperCase() + platformInfo.os.slice(1)}</span>
              {workingDirectory && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                  ✅ Watchdog Ready
                </span>
              )}
            </h3>
            <p className="text-sm text-blue-600">
              Audio: {supportedFormats.map(f => f.name).join(', ')} • 
              Using: <strong>{selectedFormat?.name}</strong>
              {workingDirectory && (
                <span className="ml-2 text-green-600">
                  • Directory: <strong>{workingDirectory.name}</strong>
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-blue-600 text-sm flex items-center space-x-4">
              <span>{supportedFormats.length} format{supportedFormats.length !== 1 ? 's' : ''} supported</span>
              <span className="text-gray-600">Next file: <strong>{fileCounter}</strong></span>
              {workingDirectory && setupStatus.isConfigured && (
                <div className="flex items-center space-x-1 text-green-600">
                  <span>🧠</span>
                  <span className="text-xs">Cached</span>
                </div>
              )}
            </div>
            <button
              onClick={resetFileCounter}
              className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs transition-colors"
              title="Reset file counter to 1"
            >
              🔄 Reset Counter
            </button>
          </div>
        </div>
      </div>

      {/* Directory setup */}
      {!workingDirectory && (
        <div className={`border p-6 rounded-lg ${
          setupStatus.isConfigured 
            ? 'bg-blue-50 border-blue-200' 
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">
                {setupStatus.isConfigured ? '🧠' : '📁'}
              </span>
              <div>
                {setupStatus.isConfigured ? (
                  <>
                    <h3 className="font-bold text-blue-800 flex items-center space-x-2">
                      <span>Directory Configuration Remembered</span>
                      <span>{getPlatformIcon(platformInfo.os)}</span>
                    </h3>
                    <p className="text-sm text-blue-600">
                      Previous setup: <strong>{setupStatus.directoryName}</strong> • 
                      Last used: {new Date(setupStatus.lastVerified).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      Click "Restore Access" to continue using your configured directory
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-amber-800 flex items-center space-x-2">
                      <span>Working Directory Required</span>
                      <span>{getPlatformIcon(platformInfo.os)}</span>
                    </h3>
                    <p className="text-sm text-amber-600">
                      Select directory where .webm files will be saved for your watchdog
                    </p>
                    <p className="text-xs text-amber-500 mt-1">
                      App creates numbered .webm files, your watchdog processes them
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex space-x-3">
              {setupStatus.isConfigured ? (
                <>
                  <button
                    onClick={restoreWorkingDirectory}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md"
                  >
                    🔄 Restore Access
                  </button>
                  <button
                    onClick={() => {
                      clearDirectoryConfig();
                      setWorkingDirectory(null);
                    }}
                    className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    title="Clear cached configuration"
                  >
                    🧹 Reset
                  </button>
                </>
              ) : (
                <button
                  onClick={setupWorkingDirectory}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors shadow-md"
                >
                  Setup Working Directory
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded flex justify-between items-start">
          <span className="text-red-700">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 font-bold text-xl ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Recording controls */}
      <div className="flex justify-center">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={permissionStatus !== 'granted' || !selectedFormat || !workingDirectory}
            className={`flex items-center space-x-4 px-10 py-5 rounded-full shadow-2xl transition-all transform hover:scale-105 ${
              permissionStatus !== 'granted' || !selectedFormat || !workingDirectory
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#075e54] hover:from-[#128C7E] hover:to-[#075e54] text-white'
            }`}
          >
            <span className="text-3xl">🎤</span>
            <div>
              <div className="font-bold text-lg">Start Recording</div>
              <div className="text-sm opacity-90">
                {selectedFormat && workingDirectory ? 
                  `${selectedFormat.name} • File: ${fileCounter}.webm` : 
                  'Setup required...'}
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center space-x-4 bg-red-500 hover:bg-red-600 text-white px-10 py-5 rounded-full shadow-2xl relative transition-all transform hover:scale-105"
          >
            <span className="text-3xl">⏹️</span>
            <div>
              <div className="font-bold text-lg">Stop Recording</div>
              <div className="text-sm opacity-90">{recordingTime}s • Saving to {fileCounter}.webm</div>
            </div>
            <span className="absolute -top-3 -right-3 w-6 h-6 bg-red-300 rounded-full animate-ping"></span>
          </button>
        )}
      </div>

      {/* Waveform visualization */}
      {isRecording && (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-5xl mx-auto">
          <canvas
            ref={canvasRef}
            width={900}
            height={140}
            className="w-full border-2 border-gray-200 rounded-lg"
          />
          <div className="text-center text-gray-600 mt-4 flex items-center justify-center space-x-3">
            <span className="animate-pulse text-2xl">🎵</span>
            <span className="font-semibold text-lg">Recording for watchdog processing • {recordingTime}s</span>
            <span className="text-sm bg-gray-100 px-2 py-1 rounded">
              {selectedFormat?.name} → {fileCounter}.webm
            </span>
          </div>
        </div>
      )}

      {/* Recordings list */}
      <div className="grid gap-4 max-w-6xl mx-auto">
        {recordings.map((rec, index) => (
          <div
            key={rec.id}
            className="flex items-center space-x-6 bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border-l-4 border-[#25D366]"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-[#25D366] to-[#075e54] rounded-full flex items-center justify-center flex-shrink-0 text-white text-3xl shadow-lg">
              🎤
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-3">
                <span className="px-4 py-2 rounded-full text-sm font-semibold bg-green-50 text-green-600">
                  Audio File #{rec.fileNumber}
                </span>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                  🤖 Ready for Watchdog
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  <span>⏱️ {rec.duration}s</span>
                  <span>📁 {formatFileSize(rec.size)}</span>
                  <span>🎵 {rec.format}</span>
                  <span>📂 {rec.directory}</span>
                </div>
                <span>{rec.timestamp}</span>
              </div>
              
              <div className="text-xs text-gray-400 mt-2 font-mono">
                📱 {rec.filename} → Your watchdog will process this to {rec.fileNumber}.ogg
              </div>
            </div>

            <div className="flex space-x-3 flex-shrink-0">
              <button
                onClick={() => removeRecording(index)}
                className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
              >
                🗑️ Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {recordings.length === 0 && !isRecording && (
        <div className="text-center text-gray-500 py-20 max-w-2xl mx-auto">
          <div className="text-8xl mb-6">🎤</div>
          <h3 className="text-3xl font-bold mb-4">Clean Audio Recorder</h3>
          <p className="text-lg mb-3 flex items-center justify-center space-x-2">
            <span>{getPlatformIcon(platformInfo.os)}</span>
            <span>External watchdog integration for {platformInfo.os}</span>
          </p>
          <p className="text-sm text-gray-400">
            Records clean .webm files • Your watchdog handles FFmpeg processing
          </p>
        </div>
      )}

      {/* Watchdog integration guide */}
      {workingDirectory && (
        <div className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 border border-green-200 p-8 rounded-xl max-w-6xl mx-auto">
          <h3 className="font-bold text-xl text-green-800 mb-6 flex items-center space-x-3">
            <span>🤖</span>
            <span>External Watchdog Integration</span>
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-700 mb-4 flex items-center space-x-2">
                <span>🎤</span>
                <span>Audio Recorder (This App)</span>
              </h4>
              <ul className="space-y-2 text-sm text-green-600">
                <li>• <strong>Creates:</strong> Numbered .webm files (1.webm, 2.webm, 3.webm...)</li>
                <li>• <strong>Quality:</strong> High-quality {selectedFormat?.name} at 320kbps</li>
                <li>• <strong>Clean Output:</strong> Only .webm files, no scripts or temp files</li>
                <li>• <strong>Persistent Counter:</strong> Remembers file numbering across sessions</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-700 mb-4 flex items-center space-x-2">
                <span>🤖</span>
                <span>Your Watchdog (External)</span>
              </h4>
              <ul className="space-y-2 text-sm text-blue-600">
                <li>• <strong>Monitors:</strong> Directory for new .webm files</li>
                <li>• <strong>Processes:</strong> FFmpeg conversion to WhatsApp-compatible .ogg</li>
                <li>• <strong>Cleans:</strong> Deletes .webm files after successful processing</li>
                <li>• <strong>Result:</strong> Clean directory with only .ogg files</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-4 flex items-center space-x-2">
              <span>🔄</span>
              <span>Perfect Workflow Integration</span>
            </h4>
            <div className="text-sm text-yellow-700">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <h5 className="font-medium mb-2">📝 Step 1: Record</h5>
                  <p>Use this app to record audio. Creates clean numbered .webm files in your directory.</p>
                </div>
                <div>
                  <h5 className="font-medium mb-2">⚙️ Step 2: Process</h5>
                  <p>Your watchdog detects new .webm files and processes them with FFmpeg automatically.</p>
                </div>
                <div>
                  <h5 className="font-medium mb-2">📱 Step 3: Use</h5>
                  <p>Upload the resulting .ogg files directly to WhatsApp. Perfect compatibility guaranteed.</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-100 rounded border border-yellow-300">
                <p className="font-medium text-yellow-800">
                  ✨ <strong>Benefits:</strong> Clean separation of concerns • No complex scripts • 
                  Automated processing • Minimal file clutter • Professional audio quality
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}