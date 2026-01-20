import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";
import { availableInstruments } from "../../constants/instruments";
import { autoCorrelate, hzToMidi } from "../../utils/pitchDetection";
import { getAudioContext, resumeAudioContext } from "../../utils/audioContext";
import "./MicrophoneInput.css";

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
  const [selectedInstrument, setSelectedInstrument] = useState("voice_oohs");

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null); // For microphone recording only
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const pitchesRef = useRef([]);
  const currentNoteRef = useRef(null);
  const statsIntervalRef = useRef(null);

  const [liveStats, setLiveStats] = useState({
    duration: 0,
    minHz: 0,
    maxHz: 0,
    pitchCount: 0,
  });

  // Load soundfont instrument on mount and when instrument changes
  useEffect(() => {
    const loadInstrument = async () => {
      const ac = await resumeAudioContext();
      const instr = await Soundfont.instrument(ac, selectedInstrument);
      setInstrument(instr);
    };

    loadInstrument();
  }, [selectedInstrument]);

  const startRecording = async () => {
    try {
      setError("");

      // Request microphone access with high quality settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
      });
      micStreamRef.current = stream;

      // Create audio context
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
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

      // Start stats update interval (every second)
      statsIntervalRef.current = setInterval(() => {
        const pitches = pitchesRef.current;
        if (pitches.length > 0) {
          setLiveStats({
            duration: parseFloat(pitches[pitches.length - 1]?.time || 0),
            minHz: Math.min(...pitches.map((p) => p.hz)),
            maxHz: Math.max(...pitches.map((p) => p.hz)),
            pitchCount: pitches.length,
          });
        }
      }, 1000);

      // Start visualization and pitch detection loop
      analyze();
    } catch (err) {
      console.error("Microphone error:", err);

      setError(`Failed to access microphone: $ {
          err.message
        }

        `);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Stop any currently playing MIDI note
    if (instrument && currentNoteRef.current !== null) {
      instrument.stop();
      currentNoteRef.current = null;
    }

    // Stop stats interval
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

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

          // Only process if we have audio data
          if (audioBlob.size > 0) {
            // Convert to AudioBuffer
            try {
              const arrayBuffer = await audioBlob.arrayBuffer();
              const decodeContext = new (
                window.AudioContext || window.webkitAudioContext
              )();
              const audioBuffer =
                await decodeContext.decodeAudioData(arrayBuffer);

              // Send to parent
              if (onAudioRecorded) {
                onAudioRecorded(audioBuffer);
              }
            } catch (err) {
              console.error("Failed to decode recorded audio:", err);
            }
          }

          resolve();
        };
      });
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close the recording audio context (not the playback context)
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
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

      const pitch = {
        time: time.toFixed(3),
        hz: Math.round(hz * 100) / 100,
      };

      setCurrentPitch(pitch);
      pitchesRef.current.push(pitch);

      // Live MIDI playback
      if (livePlayback && instrument) {
        const midiNote = hzToMidi(hz);

        // If note changed, stop previous and play new
        if (currentNoteRef.current !== midiNote) {
          if (currentNoteRef.current !== null) {
            instrument.stop();
          }

          const audioContext = getAudioContext();
          instrument.play(
            midiNote,
            audioContext.currentTime,
            {
              gain: 1.0,
            },
          );
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
    <div className="microphone-container">
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        className="microphone-canvas"
      />
      <div className="controls-row">
        {/* Section 1: Live Playback Toggle */}
        <div className="controls-section">
          <div className="tooltip-wrapper">
            <button
              onClick={() => setLivePlayback(!livePlayback)}
              disabled={!instrument || isRecording}
              className={`live-playback-button ${livePlayback ? "active" : ""} ${instrument ? "enabled" : "disabled"}`}
            >
              <span className="emoji-mic">🎤</span>
              <span className="live-text">LIVE</span>
              <span className="emoji-speaker">🔊</span>
            </button>
            <span className="tooltip-text">live MIDI</span>
          </div>
          {!instrument && (
            <span className="loading-text">(loading piano...)</span>
          )}
        </div>
        {/* Section 2: Instrument Selector */}
        <div className="controls-section">
          <div className="tooltip-wrapper">
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              disabled={isRecording}
              className="instrument-selector"
            >
              {availableInstruments.map((instr) => (
                <option key={instr.value} value={instr.value}>
                  {instr.label}
                </option>
              ))}
            </select>
            <span className="tooltip-text">select instrument</span>
          </div>
        </div>
        {/* Section 3: Start button */}
        <div className="controls-section">
          {!isRecording ? (
            <button onClick={startRecording} className="btn btn-danger">
              Start Recording
            </button>
          ) : (
            <button onClick={stopRecording} className="btn btn-primary">
              ⏹ Stop Recording
            </button>
          )}
        </div>
        {/* Section 4: Stats */}
        <div className="stats-section">
          {isRecording ? (
            <div className="recording-results">
              <p className="result-title">
                ● RECORDING - {liveStats.pitchCount} pitches detected
              </p>
              <p className="result-details">
                Duration: {liveStats.duration.toFixed(1)}s
                {liveStats.minHz > 0 && (
                  <>
                    {" | "}
                    Range: {Math.round(liveStats.minHz)}Hz -{" "}
                    {Math.round(liveStats.maxHz)}Hz
                  </>
                )}
              </p>
            </div>
          ) : recordedPitches.length > 0 ? (
            <div className="recording-results">
              <p className="result-title">
                ✓ Recorded {recordedPitches.length} pitch samples
              </p>
              <p className="result-details">
                Duration: {recordedPitches[recordedPitches.length - 1]?.time}s |
                Range: {Math.min(...recordedPitches.map((p) => p.hz))}Hz -{" "}
                {Math.max(...recordedPitches.map((p) => p.hz))}Hz
              </p>
            </div>
          ) : (
            <div className="recording-results">
              <p className="result-title">Ready to record</p>
              <p className="result-details">Press Start Recording to begin</p>
            </div>
          )}
        </div>
      </div>
      {error && <div className="message message-error mt-10"> {error}</div>}
    </div>
  );
}
