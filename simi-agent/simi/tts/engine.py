"""
Main TTS Engine - High-level interface.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import math

from simi.tts.phonemes import PhonemeDB, TextToPhoneme, Phoneme
from simi.tts.klatt import KlattSynthesizer
from simi.tts.wav import Audio, save_wav


@dataclass
class Voice:
    """Voice configuration."""
    name: str = "default"
    pitch: float = 120.0        # Base pitch (Hz)
    pitch_range: float = 20.0   # Pitch variation (Hz)
    speed: float = 1.0          # Speed multiplier
    volume: float = 1.0         # Volume multiplier

    # Voice quality
    breathiness: float = 0.0    # 0-1, adds aspiration
    roughness: float = 0.0      # 0-1, adds jitter
    nasality: float = 0.0       # 0-1, nasal quality

    @classmethod
    def male(cls) -> Voice:
        """Default male voice."""
        return cls(name="male", pitch=100.0, pitch_range=15.0)

    @classmethod
    def female(cls) -> Voice:
        """Default female voice."""
        return cls(name="female", pitch=180.0, pitch_range=30.0)

    @classmethod
    def child(cls) -> Voice:
        """Child voice."""
        return cls(name="child", pitch=250.0, pitch_range=40.0)

    @classmethod
    def robot(cls) -> Voice:
        """Robotic voice (flat pitch)."""
        return cls(name="robot", pitch=100.0, pitch_range=0.0)


class TTS:
    """
    Text-to-Speech Engine.

    Converts text to speech using Klatt formant synthesis.
    No external dependencies required.

    Example:
        >>> tts = TTS()
        >>> audio = tts.synthesize("Hello, world!")
        >>> tts.save_wav("hello.wav", audio)

        >>> # With custom voice
        >>> tts = TTS(voice=Voice.female())
        >>> audio = tts.synthesize("Hello!")

        >>> # Quick synthesis and save
        >>> tts.speak("Hello!", "output.wav")
    """

    def __init__(
        self,
        voice: Optional[Voice] = None,
        sample_rate: int = 22050,
    ):
        """
        Initialize TTS engine.

        Args:
            voice: Voice configuration
            sample_rate: Output sample rate (Hz)
        """
        self.voice = voice or Voice()
        self.sample_rate = sample_rate

        self.phoneme_db = PhonemeDB(default_f0=int(self.voice.pitch))
        self.text_to_phoneme = TextToPhoneme()
        self.synthesizer = KlattSynthesizer(sample_rate=sample_rate)

    def synthesize(self, text: str) -> Audio:
        """
        Synthesize speech from text.

        Args:
            text: Input text to synthesize

        Returns:
            Audio data
        """
        # Convert text to phonemes
        phoneme_symbols = self.text_to_phoneme.convert(text)

        # Look up phoneme parameters
        phonemes: list[Phoneme] = []
        for symbol in phoneme_symbols:
            phoneme = self.phoneme_db.get(symbol)
            if phoneme:
                # Apply voice settings
                phoneme = self._apply_voice(phoneme)
                phonemes.append(phoneme)

        if not phonemes:
            return Audio(samples=[], sample_rate=self.sample_rate)

        # Generate pitch contour
        f0_contour = self._generate_f0_contour(phonemes)

        # Synthesize
        audio = self.synthesizer.synthesize_phonemes(phonemes, f0_contour)

        # Apply volume
        audio.amplify(self.voice.volume)

        return audio

    def speak(self, text: str, filename: str) -> None:
        """
        Synthesize and save to file.

        Args:
            text: Input text
            filename: Output WAV file path
        """
        audio = self.synthesize(text)
        save_wav(filename, audio)

    def _apply_voice(self, phoneme: Phoneme) -> Phoneme:
        """Apply voice settings to phoneme."""
        # Speed adjustment
        duration = int(phoneme.duration / self.voice.speed)

        # Breathiness (add aspiration)
        ah = phoneme.ah
        if self.voice.breathiness > 0 and phoneme.voiced:
            ah = max(ah, self.voice.breathiness * 30)

        return Phoneme(
            symbol=phoneme.symbol,
            duration=duration,
            f1=phoneme.f1,
            f2=phoneme.f2,
            f3=phoneme.f3,
            f4=phoneme.f4,
            b1=phoneme.b1,
            b2=phoneme.b2,
            b3=phoneme.b3,
            b4=phoneme.b4,
            f0=int(self.voice.pitch),
            av=phoneme.av,
            ah=int(ah),
            af=phoneme.af,
            voiced=phoneme.voiced,
        )

    def _generate_f0_contour(self, phonemes: list[Phoneme]) -> list[float]:
        """
        Generate natural pitch contour.

        Creates slight pitch variations for more natural prosody.
        """
        contour: list[float] = []
        total_frames = sum(max(1, p.duration // 10) for p in phonemes)

        # Base pitch
        base_f0 = self.voice.pitch
        range_f0 = self.voice.pitch_range

        # Simple declination (pitch falls over utterance)
        for i in range(total_frames):
            t = i / max(1, total_frames - 1)

            # Declination
            decline = 1.0 - 0.1 * t

            # Micro-variation (natural jitter)
            import random
            jitter = 1.0 + (random.random() - 0.5) * 0.02 * (1 + self.voice.roughness)

            # Sentence-level intonation (simple rise-fall)
            phrase_pos = t * math.pi
            phrase_intonation = 0.5 * math.sin(phrase_pos)

            f0 = base_f0 * decline * jitter + range_f0 * phrase_intonation
            contour.append(f0)

        return contour

    @staticmethod
    def save_wav(filename: str, audio: Audio) -> None:
        """Save audio to WAV file."""
        save_wav(filename, audio)


def speak(text: str, filename: str, voice: Optional[Voice] = None) -> None:
    """
    Quick function to synthesize and save speech.

    Args:
        text: Text to synthesize
        filename: Output WAV file
        voice: Optional voice settings
    """
    tts = TTS(voice=voice)
    tts.speak(text, filename)
