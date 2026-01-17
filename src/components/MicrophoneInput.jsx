import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";

// Autocorrelation pitch detection (same as PitchDetector)
function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let best_offset = -1;
  let best_correlation = 0;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) return -1;

  let lastCorrelation = 1;
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }

    correlation = 1 - correlation / MAX_SAMPLES;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      const foundGoodCorrelation = correlation > best_correlation;
      if (foundGoodCorrelation) {
        best_correlation = correlation;
        best_offset = offset;
      }
    }

    lastCorrelation = correlation;
  }

  if (best_offset === -1) return -1;

  const hz = sampleRate / best_offset;
  return hz;
}

export default function MicrophoneInput({
  onPitchesRecorded,
  onAudioRecorded,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentPitch, setCurrentPitch] = useState(null);
  const [recordedPitches, setRecordedPitches] = useState([]);
  const [error, setError] = useState("");
  const [livePlayback, setLivePlayback] = useState(false);
  const [instrument, setInstrument] = useState(null);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const pitchesRef = useRef([]);
  const currentNoteRef = useRef(null);
  const playbackAudioContextRef = useRef(null);

  // Load soundfont instrument on mount
  useEffect(() => {
    const loadInstrument = async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      playbackAudioContextRef.current = ac;
      const instr = await Soundfont.instrument(ac, "acoustic_grand_piano");
      setInstrument(instr);
    };
    loadInstrument();

    return () => {
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError("");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Set up MediaRecorder to capture raw audio
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();

      setIsRecording(true);
      // eslint-disable-next-line react-hooks/purity
      startTimeRef.current = performance.now();
      pitchesRef.current = [];
      setRecordedPitches([]);

      // Start visualization and pitch detection loop
      analyze();
    } catch (err) {
      console.error("Microphone error:", err);
      setError(`Failed to access microphone: ${err.message}`);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Stop MediaRecorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();

      // Wait for final data and process audio
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          // Convert to AudioBuffer
          try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext ||
              window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Send to parent for spectrogram analysis
            if (onAudioRecorded) {
              onAudioRecorded(audioBuffer, audioContext);
            }
          } catch (err) {
            console.error("Failed to decode recorded audio:", err);
          }

          resolve();
        };
      });
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Save recorded pitches
    const pitches = pitchesRef.current;
    setRecordedPitches(pitches);

    // Notify parent
    if (onPitchesRecorded && pitches.length > 0) {
      onPitchesRecorded(pitches);
    }
  };

  const analyze = () => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;

    if (!analyser || !audioContext) return;

    animationRef.current = requestAnimationFrame(analyze);

    // Get time domain data for pitch detection
    const bufferLength = analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(timeDomainData);

    // Detect pitch
    const hz = autoCorrelate(timeDomainData, audioContext.sampleRate);

    if (hz > 50 && hz < 1000) {
      // eslint-disable-next-line react-hooks/purity
      const time = (performance.now() - startTimeRef.current) / 1000;
      const pitch = { time: time.toFixed(3), hz: Math.round(hz * 100) / 100 };

      setCurrentPitch(pitch);
      pitchesRef.current.push(pitch);

      // Live MIDI playback
      if (livePlayback && instrument) {
        const midiNote = Math.round(69 + 12 * Math.log2(hz / 440));
        
        // If note changed, stop previous and play new
        if (currentNoteRef.current !== midiNote) {
          if (currentNoteRef.current !== null) {
            instrument.stop();
          }
          instrument.play(midiNote, playbackAudioContextRef.current.currentTime, {
            duration: 0.5,
            gain: 0.3,
          });
          currentNoteRef.current = midiNote;
        }
      }
    } else {
      setCurrentPitch(null);
      
      // Stop playing when no pitch detected
      if (livePlayback && instrument && currentNoteRef.current !== null) {
        instrument.stop();
        currentNoteRef.current = null;
      }
    }

    // Get frequency data for visualization
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // Draw spectrum
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const barWidth = (width / frequencyData.length) * 2.5;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * height;
      const hue = (i / frequencyData.length) * 240;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    // Draw current pitch indicator
    if (currentPitch) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px monospace";
      ctx.fillText(`${currentPitch.hz} Hz`, 10, 30);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        style={{
          border: "2px solid #333",
          borderRadius: "4px",
          display: "block",
          margin: "0px auto 10px auto",
          background: "#000",
        }}
      />

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "flex", alignItems: "center", marginBottom: "10px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={livePlayback}
            onChange={(e) => setLivePlayback(e.target.checked)}
            disabled={!instrument || isRecording}
            style={{ marginRight: "8px" }}
          />
          <span style={{ fontSize: "14px", color: instrument ? "#333" : "#999" }}>
            🎹 Enable Live MIDI Playback {!instrument && "(loading piano...)"}
          </span>
        </label>
      </div>

      <div style={{ marginBottom: "15px" }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              marginRight: "10px",
            }}
          >
            🔴 Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
              background: "#555",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              marginRight: "10px",
            }}
          >
            ⏹ Stop Recording
          </button>
        )}

        {isRecording && (
          <span style={{ color: "#e74c3c", fontWeight: "bold" }}>
            ● RECORDING - {pitchesRef.current.length} pitches detected
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: "red", marginTop: "10px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {recordedPitches.length > 0 && !isRecording && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            background: "#e8f4f8",
            borderRadius: "4px",
          }}
        >
          <p style={{ fontWeight: "bold", color: "#2c3e50" }}>
            ✓ Recorded {recordedPitches.length} pitch samples
          </p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
            Duration: {recordedPitches[recordedPitches.length - 1]?.time}s |
            Range: {Math.min(...recordedPitches.map((p) => p.hz))}Hz -{" "}
            {Math.max(...recordedPitches.map((p) => p.hz))}Hz
          </p>
          <p style={{ fontSize: "12px", color: "#999", marginTop: "5px" }}>
            You can now generate MIDI from this recording!
          </p>
        </div>
      )}
    </div>
  );
}
