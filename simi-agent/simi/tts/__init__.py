"""
Simi TTS - Low-level Text-to-Speech Engine

A dependency-free formant synthesis TTS based on Klatt synthesizer.

Features:
- No external dependencies (pure Python + stdlib)
- Klatt-style formant synthesis
- English phoneme support
- WAV output

Example:
    >>> from simi.tts import TTS
    >>> tts = TTS()
    >>> audio = tts.synthesize("Hello world")
    >>> tts.save_wav("output.wav", audio)
"""

from simi.tts.engine import TTS, Voice
from simi.tts.klatt import KlattSynthesizer
from simi.tts.phonemes import Phoneme, PhonemeDB
from simi.tts.wav import save_wav, Audio

__all__ = [
    "TTS",
    "Voice",
    "KlattSynthesizer",
    "Phoneme",
    "PhonemeDB",
    "save_wav",
    "Audio",
]
