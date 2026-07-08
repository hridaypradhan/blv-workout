export interface SpokenPhrase {
  text: string;
  timestamp: number;
}

let recentlySpokenPhrases: SpokenPhrase[] = [];
let lastSpeechEndTime = 0;
let isMonkeyPatched = false;

export function registerSpokenPhrase(text: string) {
  const norm = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (!norm) return;
  recentlySpokenPhrases.push({ text: norm, timestamp: Date.now() });
  // Keep last 10 phrases
  if (recentlySpokenPhrases.length > 10) {
    recentlySpokenPhrases.shift();
  }
}

export function setLastSpeechEndTime(time: number) {
  lastSpeechEndTime = time;
}

export function getLastSpeechEndTime(): number {
  return lastSpeechEndTime;
}

export function isSpeakingOrRecentlySpoken(transcript: string, maxAgeMs = 7000): boolean {
  if (typeof window === "undefined") return false;
  
  // 1. Check if currently speaking
  if (window.speechSynthesis?.speaking) {
    return true;
  }
  
  // 2. Check if finished speaking recently (within maxAgeMs)
  const now = Date.now();
  if (now - lastSpeechEndTime < maxAgeMs) {
    return true;
  }
  
  // 3. Check if transcript matches any recently spoken phrase
  const normTrans = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  for (const phrase of recentlySpokenPhrases) {
    // Check if the phrase was spoken recently
    if (now - phrase.timestamp < maxAgeMs * 2) {
      if (phrase.text.includes(normTrans) || normTrans.includes(phrase.text)) {
        return true;
      }
    }
  }
  
  return false;
}

export function initSpeechRegistryMonkeyPatch() {
  if (typeof window === "undefined" || isMonkeyPatched) return;
  if (!window.speechSynthesis) return;

  const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak = function (utterance: SpeechSynthesisUtterance) {
    if (utterance && utterance.text) {
      registerSpokenPhrase(utterance.text);
      
      const origOnEnd = utterance.onend;
      utterance.onend = function (ev) {
        setLastSpeechEndTime(Date.now());
        if (origOnEnd) {
          origOnEnd.call(this, ev);
        }
      };

      const origOnError = utterance.onerror;
      utterance.onerror = function (ev) {
        setLastSpeechEndTime(Date.now());
        if (origOnError) {
          origOnError.call(this, ev);
        }
      };
    }
    return originalSpeak(utterance);
  };
  isMonkeyPatched = true;
}

/**
 * Resets the speech registry state. Useful in unit tests.
 */
export function resetSpeechRegistry() {
  recentlySpokenPhrases = [];
  lastSpeechEndTime = 0;
}
