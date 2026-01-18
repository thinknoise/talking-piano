import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";
import "./MIDIPlayer.css";

export default function MIDIPlayer({ pitchData }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [instrument, setInstrument] = useState(null);
  const [progress, setProgress] = useState(0);
  const audioContextRef = useRef(null);
  const playbackRef = useRef(null);

  useEffect(() => {
    // Initialize AudioContext and load instrument
    const initAudio = async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ac;

      // Load acoustic grand piano soundfont
      const instr = await Soundfont.instrument(ac, "acoustic_grand_piano");
      setInstrument(instr);
    };

    initAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playMIDI = async () => {
    if (!instrument || !pitchData || pitchData.length === 0) return;

    setIsPlaying(true);
    setProgress(0);

    // Convert Hz to MIDI note numbers
    const notes = pitchData.map((pitch) => {
      const hz = pitch.hz;
      const midiNote = Math.round(69 + 12 * Math.log2(hz / 440));

      return {
        time: parseFloat(pitch.time),
        midi: midiNote,
        hz: hz,
      };
    });

    // Group notes by time windows (20ms)
    const timeWindowSize = 0.02;
    const noteGroups = [];
    let currentGroup = [];
    let currentTime = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];

      if (note.time - currentTime < timeWindowSize) {
        currentGroup.push(note);
      } else {
        if (currentGroup.length > 0) {
          noteGroups.push({
            time: currentTime,
            notes: currentGroup,
          });
        }

        currentGroup = [note];
        currentTime = note.time;
      }
    }

    if (currentGroup.length > 0) {
      noteGroups.push({
        time: currentTime,
        notes: currentGroup,
      });
    }

    // Play notes
    const startTime = audioContextRef.current.currentTime;
    const totalDuration = noteGroups[noteGroups.length - 1]?.time || 0;

    playbackRef.current = {
      active: true,
    };

    for (let i = 0; i < noteGroups.length; i++) {
      if (!playbackRef.current?.active) break;

      const group = noteGroups[i];
      const playTime = startTime + group.time;

      // Play all notes in the group as a chord
      group.notes.forEach((note) => {
        instrument.play(note.midi, playTime, {
          duration: 0.2,
        });
      });

      // Update progress
      setProgress(Math.round((group.time / totalDuration) * 100));

      // Wait for next group
      if (i < noteGroups.length - 1) {
        const delay = (noteGroups[i + 1].time - group.time) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setIsPlaying(false);
    setProgress(100);
  };

  const stopPlayback = () => {
    if (playbackRef.current) {
      playbackRef.current.active = false;
    }

    setIsPlaying(false);
    setProgress(0);
  };

  if (!pitchData || pitchData.length === 0) {
    return null;
  }

  return (
    <div className="midi-player-container">
      {" "}
      <h3>🎹 MIDI Player</h3>{" "}
      <p className="midi-player-description">
        {" "}
        Play your detected pitches as MIDI audio in the browser{" "}
      </p>{" "}
      <div className="midi-player-controls">
        {" "}
        {!isPlaying ? (
          <button
            onClick={playMIDI}
            disabled={!instrument}
            className={`btn btn-large ${instrument ? "btn-primary" : "btn-disabled"}`}
          >
            ▶️ Play MIDI
          </button>
        ) : (
          <button onClick={stopPlayback} className="btn btn-large btn-primary">
            {" "}
            ⏹ Stop{" "}
          </button>
        )}
        {!instrument && (
          <span className="midi-player-loading">
            {" "}
            Loading piano soundfont...{" "}
          </span>
        )}
      </div>{" "}
      {isPlaying && (
        <div>
          <div className="midi-player-progress-container">
            <div
              className="midi-player-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="midi-player-progress-text">Playing... {progress}%</p>
        </div>
      )}
      <p className="midi-player-info">
        {" "}
        Using acoustic grand piano soundfont • {pitchData.length}
        pitch samples{" "}
      </p>{" "}
    </div>
  );
}
