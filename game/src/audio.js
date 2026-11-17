// Synthesised sound effects with WebAudio: no audio files, every sound is built from
// oscillators and noise at play time. The context is created lazily on the first user
// gesture (browsers block audio before one) and every call is guarded, so the game plays
// silently rather than crashing where audio is unavailable.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, endFreq, seconds, type, volume, when) {
    if (!context || muted) return;
    const start = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise(seconds, volume, filterFreq) {
    if (!context || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call on the first user gesture; also resumes a suspended context. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 320, 0.09, 'sine', 0.5);
    },
    hit() {
      noise(0.08, 0.35, 2400);
      tone(220, 90, 0.1, 'triangle', 0.4);
    },
    pickup() {
      tone(660, 990, 0.12, 'sine', 0.45);
      tone(990, 1320, 0.1, 'sine', 0.3, 0.06);
    },
    hurt() {
      tone(160, 60, 0.25, 'sawtooth', 0.5);
      noise(0.18, 0.3, 900);
    },
    horn() {
      tone(196, 196, 0.35, 'triangle', 0.5);
      tone(294, 294, 0.35, 'triangle', 0.4, 0.05);
      tone(392, 392, 0.4, 'triangle', 0.35, 0.1);
    },
    upgrade() {
      tone(523, 523, 0.12, 'sine', 0.45);
      tone(659, 659, 0.12, 'sine', 0.45, 0.08);
      tone(784, 784, 0.2, 'sine', 0.45, 0.16);
    },
    over() {
      tone(392, 392, 0.3, 'triangle', 0.45);
      tone(311, 311, 0.3, 'triangle', 0.45, 0.25);
      tone(233, 155, 0.6, 'triangle', 0.45, 0.5);
    },
  };
}
