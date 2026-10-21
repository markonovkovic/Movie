'use strict';

// Background music, generated live in the browser with the Web Audio API: no audio files to
// download and nothing to license. Slow pad chords with soft bell notes on top, through a
// gentle reverb. The style follows the chosen mood (brighter for happy, softer for sad, ...).
//
// Browsers only allow sound after the user has interacted with the page, so "on" (the
// default) means: start at the first tap or key press.

(function () {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return; // no Web Audio: no music (the app hides the button)

  const PREF_KEY = 'moviepicker:music';
  const VOLUME = 0.55;

  // Note helpers: MIDI note number → frequency.
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  // Each style: chord progression (MIDI notes), bell scale, seconds per chord, filter brightness
  // and how often a bell note plays (chance per beat).
  const STYLES = {
    calm: {
      chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], // D, Bm, G, A
      bells: [74, 76, 78, 81, 83, 86], seconds: 8, bright: 1500, bellChance: 0.35,
    },
    bright: {
      chords: [[48, 55, 60, 64], [53, 60, 64, 69], [45, 52, 57, 60], [55, 62, 67, 71]], // C, F, Am, G
      bells: [72, 74, 76, 79, 81, 84, 86, 88], seconds: 6, bright: 2400, bellChance: 0.55,
    },
    gentle: {
      chords: [[41, 48, 57, 64], [46, 53, 62, 69], [45, 52, 60, 67], [43, 50, 58, 65]], // Fmaj7, Bbmaj7, Am7, Gm7
      bells: [72, 74, 77, 79, 81, 84], seconds: 10, bright: 1100, bellChance: 0.25,
    },
    warm: {
      chords: [[51, 58, 62, 67], [48, 55, 63, 67], [44, 51, 60, 67], [46, 53, 62, 65]], // Ebmaj7, Cm7, Abmaj7, Bb
      bells: [75, 77, 79, 82, 84, 87], seconds: 8, bright: 1700, bellChance: 0.4,
    },
    mysterious: {
      chords: [[45, 52, 60, 64], [41, 48, 57, 64], [43, 50, 59, 62], [40, 47, 55, 59]], // Am, Fmaj7, G, Em
      bells: [69, 71, 72, 76, 79, 81, 83], seconds: 9, bright: 1300, bellChance: 0.3,
    },
  };
  const MOOD_STYLE = {
    happy: 'bright', adventurous: 'bright', bored: 'bright', angry: 'bright', unmotivated: 'bright',
    sad: 'gentle', lonely: 'gentle', tired: 'gentle', stressed: 'gentle', scared: 'gentle',
    loved: 'warm', nostalgic: 'warm',
    curious: 'mysterious', relaxed: 'mysterious',
    // Genres (the home screen's choice)
    Comedy: 'bright', Animation: 'bright', Family: 'bright', Adventure: 'bright', Action: 'bright', Music: 'bright',
    Fantasy: 'bright', Western: 'bright', Sport: 'bright',
    Drama: 'gentle', History: 'gentle', War: 'gentle', Documentary: 'gentle', Biography: 'gentle',
    Romance: 'warm',
    Horror: 'mysterious', Thriller: 'mysterious', Mystery: 'mysterious', Crime: 'mysterious', 'Sci-Fi': 'mysterious',
    // Styles
    Superhero: 'bright', Anime: 'bright', Musical: 'bright', Sports: 'bright', Christmas: 'bright', 'Martial Arts': 'bright',
    'Road Trip': 'bright', 'Stand-up': 'bright', Disaster: 'bright',
    Romcom: 'warm', 'Coming of Age': 'warm',
    'True Story': 'gentle',
    Heist: 'mysterious', Spy: 'mysterious', 'Time Travel': 'mysterious', Space: 'mysterious', Dystopia: 'mysterious',
    Zombie: 'mysterious', 'Serial Killer': 'mysterious', Psychological: 'mysterious', Monster: 'mysterious',
  };

  let ctx = null;
  let master = null; // overall volume (fades, ducking)
  let pad = null; // pad filter input
  let wet = null; // reverb input
  let style = STYLES.calm;
  let chordIndex = 0;
  let timer = null;
  let ducked = false;
  const listeners = new Set();

  function readPref() {
    try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
  }
  let enabled = readPref();

  // A soft, generated reverb: three seconds of fading stereo noise.
  function reverbImpulse() {
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  }

  function build() {
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse();
    wet = ctx.createGain();
    wet.gain.value = 0.9;
    wet.connect(reverb).connect(master);

    // Pads go through a low-pass filter that slowly "breathes" open and closed.
    pad = ctx.createBiquadFilter();
    pad.type = 'lowpass';
    pad.frequency.value = style.bright;
    pad.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoDepth.gain.value = 400;
    lfo.connect(lfoDepth).connect(pad.frequency);
    lfo.start();
    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    pad.connect(dry).connect(master);
    pad.connect(wet);
  }

  function playChord(notes, start, seconds) {
    const end = start + seconds + 4; // overlaps the next chord for a smooth change
    notes.forEach((note, i) => {
      // Two slightly detuned voices per note make the pad sound wide and soft.
      [-4, 4].forEach((detune, v) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = v ? 'sine' : 'triangle';
        osc.frequency.value = hz(note);
        osc.detune.value = detune;
        const level = (i === 0 ? 0.05 : 0.03) / 2;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + 3);
        gain.gain.setValueAtTime(level, start + seconds);
        gain.gain.linearRampToValueAtTime(0, end);
        osc.connect(gain).connect(pad);
        osc.start(start);
        osc.stop(end + 0.1);
      });
    });
  }

  function playBell(note, start) {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const overtoneGain = ctx.createGain();
    osc.type = 'sine';
    overtone.type = 'sine';
    osc.frequency.value = hz(note);
    overtone.frequency.value = hz(note) * 3;
    overtoneGain.gain.value = 0.15;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.045, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.5);
    osc.connect(gain);
    overtone.connect(overtoneGain).connect(gain);
    gain.connect(wet);
    const dry = ctx.createGain();
    dry.gain.value = 0.35;
    gain.connect(dry).connect(master);
    [osc, overtone].forEach((o) => { o.start(start); o.stop(start + 3.6); });
  }

  // Plays one chord with a few bell notes over it, then schedules the next one.
  function step() {
    const now = ctx.currentTime + 0.05;
    const { chords, bells, seconds, bellChance } = style;
    pad.frequency.setTargetAtTime(style.bright, now, 2);
    playChord(chords[chordIndex % chords.length], now, seconds);
    chordIndex++;
    const beats = Math.round(seconds / 1.5);
    for (let b = 1; b < beats; b++) {
      if (Math.random() < bellChance) playBell(bells[Math.floor(Math.random() * bells.length)], now + b * 1.5 + Math.random() * 0.2);
    }
    timer = setTimeout(step, seconds * 1000);
  }

  const playing = () => Boolean(ctx && ctx.state === 'running' && timer);

  function fadeTo(value, seconds = 1.5) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(value, t + seconds);
  }

  function notify() { listeners.forEach((fn) => fn({ enabled, playing: playing() })); }

  async function start() {
    if (!ctx) build();
    try { await ctx.resume(); } catch { return; }
    if (ctx.state !== 'running') return; // still blocked: the first tap starts it
    if (!timer) step();
    fadeTo(ducked ? 0 : VOLUME, 2.5);
    notify();
  }

  async function stop() {
    clearTimeout(timer);
    timer = null;
    if (ctx && ctx.state === 'running') {
      fadeTo(0, 0.6);
      await new Promise((r) => setTimeout(r, 650));
      if (!timer) await ctx.suspend();
    }
    notify();
  }

  function save() {
    try {
      if (enabled) localStorage.removeItem(PREF_KEY);
      else localStorage.setItem(PREF_KEY, 'off');
    } catch { /* not saved, still applied */ }
  }

  // "On" starts as soon as the app opens. Browsers often block sound until the visitor has
  // interacted with the page (installed apps and sites people use a lot are usually allowed),
  // so if it's blocked, the first tap, click or key press anywhere starts it.
  const UNLOCK_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'touchend', 'click', 'keydown'];
  function unlock(e) {
    if (e && e.target && e.target.closest && e.target.closest('#music-toggle')) return; // the button handles itself
    UNLOCK_EVENTS.forEach((t) => document.removeEventListener(t, unlock, true));
    if (enabled && !playing() && !document.hidden) start();
  }
  UNLOCK_EVENTS.forEach((t) => document.addEventListener(t, unlock, true));
  if (enabled && !document.hidden) start();

  // Pause while the app is in the background, carry on when it's back.
  document.addEventListener('visibilitychange', () => {
    if (!enabled || !ctx) return;
    if (document.hidden) stop();
    else start();
  });

  window.Music = {
    get enabled() { return enabled; },
    get playing() { return playing(); },
    onChange(fn) { listeners.add(fn); fn({ enabled, playing: playing() }); },
    // The header button: turns music off, or on (starting it straight away).
    toggle() {
      // On but not started yet (no tap so far): this tap starts it rather than turning it off.
      enabled = !(enabled && playing());
      save();
      if (enabled) start(); else stop();
      notify();
    },
    // Switches style for the chosen genre or emotions (the first one leads); from the next chord on.
    setMood(keys = []) {
      style = STYLES[MOOD_STYLE[keys[0]]] || STYLES.calm;
    },
    // Quieter while a trailer plays.
    duck(on) {
      ducked = on;
      if (playing()) fadeTo(on ? 0 : VOLUME, on ? 0.5 : 2);
    },
    // A soft "whoosh" when a card flips.
    whoosh() {
      if (!playing() || ducked) return;
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.2;
      band.frequency.setValueAtTime(300, t);
      band.frequency.exponentialRampToValueAtTime(2800, t + 0.45);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      noise.connect(band).connect(gain);
      gain.connect(master);
      gain.connect(wet);
      noise.start(t);
      noise.stop(t + 0.8);
    },
  };
}());
