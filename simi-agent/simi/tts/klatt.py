"""
Klatt Formant Synthesizer

A pure Python implementation of the Klatt cascade-parallel formant synthesizer
based on Klatt 1980 "Software for a cascade/parallel formant synthesizer".

No external dependencies - uses only Python standard library.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Optional

from simi.tts.phonemes import Phoneme
from simi.tts.wav import Audio


@dataclass
class KlattParams:
    """Parameters for one frame of synthesis (typically 10ms)."""
    f0: float = 120.0      # Fundamental frequency (Hz)
    f1: float = 500.0      # First formant (Hz)
    f2: float = 1500.0     # Second formant (Hz)
    f3: float = 2500.0     # Third formant (Hz)
    f4: float = 3500.0     # Fourth formant (Hz)
    f5: float = 4500.0     # Fifth formant (Hz)
    f6: float = 5500.0     # Sixth formant (Hz)
    fnp: float = 250.0     # Nasal pole frequency
    fnz: float = 250.0     # Nasal zero frequency

    b1: float = 60.0       # First formant bandwidth (Hz)
    b2: float = 90.0       # Second formant bandwidth
    b3: float = 150.0      # Third formant bandwidth
    b4: float = 200.0      # Fourth formant bandwidth
    b5: float = 200.0
    b6: float = 200.0
    bnp: float = 100.0     # Nasal pole bandwidth
    bnz: float = 100.0     # Nasal zero bandwidth

    av: float = 60.0       # Voicing amplitude (0-80 dB)
    ah: float = 0.0        # Aspiration amplitude
    af: float = 0.0        # Frication amplitude
    a1: float = 0.0        # Parallel F1 amplitude
    a2: float = 0.0        # Parallel F2 amplitude
    a3: float = 0.0        # Parallel F3 amplitude
    a4: float = 0.0        # Parallel F4 amplitude
    a5: float = 0.0
    a6: float = 0.0
    ab: float = 0.0        # Bypass amplitude
    an: float = 0.0        # Nasal amplitude


class Resonator:
    """
    Second-order digital resonator (bandpass filter).

    Implements the difference equation:
        y[n] = a*x[n] + b*y[n-1] + c*y[n-2]

    Used for formant filtering in the cascade configuration.
    """

    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
        self.a = 0.0
        self.b = 0.0
        self.c = 0.0
        self.y1 = 0.0  # y[n-1]
        self.y2 = 0.0  # y[n-2]

    def set_params(self, freq: float, bandwidth: float) -> None:
        """
        Set resonator frequency and bandwidth.

        Args:
            freq: Center frequency (Hz)
            bandwidth: 3dB bandwidth (Hz)
        """
        if freq <= 0:
            self.a = 0
            self.b = 0
            self.c = 0
            return

        # Convert to digital filter coefficients
        # Using bilinear transform approximation
        T = 1.0 / self.sample_rate
        pi_T = math.pi * T

        r = math.exp(-pi_T * bandwidth)
        theta = 2 * math.pi * freq * T

        self.c = -r * r
        self.b = 2 * r * math.cos(theta)
        self.a = 1.0 - self.b - self.c

    def process(self, x: float) -> float:
        """Process one sample through the resonator."""
        y = self.a * x + self.b * self.y1 + self.c * self.y2
        self.y2 = self.y1
        self.y1 = y
        return y

    def reset(self) -> None:
        """Reset filter state."""
        self.y1 = 0.0
        self.y2 = 0.0


class AntiResonator:
    """
    Second-order digital anti-resonator (notch filter).

    Used for nasal zeros and other spectral zeros.
    """

    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
        self.a = 1.0
        self.b = 0.0
        self.c = 0.0
        self.x1 = 0.0
        self.x2 = 0.0

    def set_params(self, freq: float, bandwidth: float) -> None:
        """Set anti-resonator frequency and bandwidth."""
        if freq <= 0:
            self.a = 1.0
            self.b = 0.0
            self.c = 0.0
            return

        T = 1.0 / self.sample_rate
        pi_T = math.pi * T

        r = math.exp(-pi_T * bandwidth)
        theta = 2 * math.pi * freq * T

        self.c = r * r
        self.b = -2 * r * math.cos(theta)
        self.a = 1.0 / (1.0 + self.b + self.c)
        self.b *= self.a
        self.c *= self.a

    def process(self, x: float) -> float:
        """Process one sample."""
        y = self.a * x + self.b * self.x1 + self.c * self.x2
        self.x2 = self.x1
        self.x1 = x
        return y

    def reset(self) -> None:
        self.x1 = 0.0
        self.x2 = 0.0


class GlottalSource:
    """
    Glottal waveform generator.

    Generates a periodic impulse train with natural glottal waveform shape.
    Based on Rosenberg's model.
    """

    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
        self.phase = 0.0
        self.t0 = 0.0       # Period in samples
        self.open_quota = 0.7  # Open phase quota

    def set_f0(self, f0: float) -> None:
        """Set fundamental frequency."""
        if f0 > 0:
            self.t0 = self.sample_rate / f0
        else:
            self.t0 = 0

    def generate(self) -> float:
        """Generate one sample of glottal waveform."""
        if self.t0 <= 0:
            return 0.0

        # Normalized position in period [0, 1)
        t_norm = self.phase / self.t0

        # Rosenberg glottal pulse model
        open_phase = self.open_quota
        if t_norm < open_phase:
            # Opening phase: rising
            x = t_norm / open_phase
            output = 3 * x * x - 2 * x * x * x
        elif t_norm < open_phase + 0.1:
            # Closing phase: falling
            x = (t_norm - open_phase) / 0.1
            output = 1.0 - x
        else:
            # Closed phase
            output = 0.0

        # Advance phase
        self.phase += 1.0
        if self.phase >= self.t0:
            self.phase -= self.t0

        return output

    def reset(self) -> None:
        self.phase = 0.0


class NoiseSource:
    """
    White noise generator for aspiration and frication.
    """

    def generate(self) -> float:
        """Generate one sample of white noise."""
        return random.uniform(-1.0, 1.0)


class KlattSynthesizer:
    """
    Klatt cascade-parallel formant synthesizer.

    Synthesizes speech from phoneme sequences using formant synthesis.
    Based on Klatt 1980 with simplifications for pure Python implementation.

    Example:
        >>> synth = KlattSynthesizer(sample_rate=22050)
        >>> audio = synth.synthesize_phonemes([
        ...     Phoneme("HH", 60, 500, 1500, 2500, 3500, ...),
        ...     Phoneme("EH", 100, 530, 1840, 2480, 3500, ...),
        ... ])
        >>> save_wav("hello.wav", audio)
    """

    def __init__(
        self,
        sample_rate: int = 22050,
        frame_ms: int = 10,
    ):
        """
        Initialize synthesizer.

        Args:
            sample_rate: Audio sample rate (Hz)
            frame_ms: Frame duration (milliseconds)
        """
        self.sample_rate = sample_rate
        self.frame_ms = frame_ms
        self.samples_per_frame = int(sample_rate * frame_ms / 1000)

        # Sound sources
        self.glottal = GlottalSource(sample_rate)
        self.noise = NoiseSource()

        # Cascade resonators (for vowels)
        self.r1 = Resonator(sample_rate)
        self.r2 = Resonator(sample_rate)
        self.r3 = Resonator(sample_rate)
        self.r4 = Resonator(sample_rate)
        self.r5 = Resonator(sample_rate)
        self.r6 = Resonator(sample_rate)

        # Nasal resonator and anti-resonator
        self.rnp = Resonator(sample_rate)
        self.rnz = AntiResonator(sample_rate)

        # Parallel resonators (for fricatives)
        self.p1 = Resonator(sample_rate)
        self.p2 = Resonator(sample_rate)
        self.p3 = Resonator(sample_rate)
        self.p4 = Resonator(sample_rate)
        self.p5 = Resonator(sample_rate)
        self.p6 = Resonator(sample_rate)

        # Radiation characteristic (simple first-order differentiator)
        self.rad_prev = 0.0

    def synthesize_phonemes(
        self,
        phonemes: list[Phoneme],
        f0_contour: Optional[list[float]] = None,
    ) -> Audio:
        """
        Synthesize speech from phoneme sequence.

        Args:
            phonemes: List of phonemes with formant parameters
            f0_contour: Optional pitch contour (Hz per frame)

        Returns:
            Synthesized audio
        """
        samples: list[float] = []
        frame_idx = 0

        for i, phoneme in enumerate(phonemes):
            # Get next phoneme for coarticulation
            next_phoneme = phonemes[i + 1] if i + 1 < len(phonemes) else None

            # Number of frames for this phoneme
            n_frames = max(1, phoneme.duration // self.frame_ms)

            for j in range(n_frames):
                # Calculate interpolation factor for smooth transitions
                t = j / n_frames if n_frames > 1 else 0.5

                # Get parameters for this frame
                params = self._interpolate_params(phoneme, next_phoneme, t)

                # Apply f0 contour if provided
                if f0_contour and frame_idx < len(f0_contour):
                    params.f0 = f0_contour[frame_idx]

                # Synthesize one frame
                frame_samples = self._synthesize_frame(params)
                samples.extend(frame_samples)

                frame_idx += 1

        # Normalize and create audio
        audio = Audio(samples=samples, sample_rate=self.sample_rate)
        audio.normalize()
        audio.amplify(0.8)  # Leave some headroom
        audio.fade_in(0.01)
        audio.fade_out(0.02)

        return audio

    def _interpolate_params(
        self,
        current: Phoneme,
        next_phoneme: Optional[Phoneme],
        t: float,
    ) -> KlattParams:
        """Interpolate between phoneme parameters for smooth transitions."""

        def lerp(a: float, b: float, t: float) -> float:
            return a + (b - a) * t

        params = KlattParams()

        # Current phoneme values
        params.f0 = float(current.f0)
        params.f1 = float(current.f1)
        params.f2 = float(current.f2)
        params.f3 = float(current.f3)
        params.f4 = float(current.f4)
        params.b1 = float(current.b1)
        params.b2 = float(current.b2)
        params.b3 = float(current.b3)
        params.b4 = float(current.b4)
        params.av = float(current.av)
        params.ah = float(current.ah)
        params.af = float(current.af)

        # Interpolate towards next phoneme in last 30% of duration
        if next_phoneme and t > 0.7:
            blend = (t - 0.7) / 0.3
            params.f1 = lerp(current.f1, next_phoneme.f1, blend)
            params.f2 = lerp(current.f2, next_phoneme.f2, blend)
            params.f3 = lerp(current.f3, next_phoneme.f3, blend)
            params.f4 = lerp(current.f4, next_phoneme.f4, blend)

        return params

    def _synthesize_frame(self, params: KlattParams) -> list[float]:
        """Synthesize one frame of audio."""
        samples = []

        # Update resonator parameters
        self._update_resonators(params)

        # Convert dB to linear amplitude
        av_amp = self._db_to_amp(params.av) if params.av > 0 else 0
        ah_amp = self._db_to_amp(params.ah) if params.ah > 0 else 0
        af_amp = self._db_to_amp(params.af) if params.af > 0 else 0

        # Set fundamental frequency
        self.glottal.set_f0(params.f0)

        for _ in range(self.samples_per_frame):
            # Generate sources
            voice = self.glottal.generate() * av_amp
            aspiration = self.noise.generate() * ah_amp * 0.3
            frication = self.noise.generate() * af_amp * 0.3

            # Cascade synthesis path (for voiced sounds)
            cascade_in = voice + aspiration
            cascade_out = self._cascade_filter(cascade_in)

            # Parallel synthesis path (for fricatives)
            parallel_out = self._parallel_filter(frication, params)

            # Combine paths
            output = cascade_out + parallel_out

            # Radiation characteristic (simple differentiator)
            radiated = output - self.rad_prev
            self.rad_prev = output * 0.99

            samples.append(radiated)

        return samples

    def _update_resonators(self, params: KlattParams) -> None:
        """Update all resonator parameters."""
        # Cascade resonators
        self.r1.set_params(params.f1, params.b1)
        self.r2.set_params(params.f2, params.b2)
        self.r3.set_params(params.f3, params.b3)
        self.r4.set_params(params.f4, params.b4)
        self.r5.set_params(params.f5, 200)
        self.r6.set_params(params.f6, 200)

        # Nasal
        self.rnp.set_params(params.fnp, params.bnp)
        self.rnz.set_params(params.fnz, params.bnz)

        # Parallel resonators (same frequencies, narrower bandwidths)
        self.p1.set_params(params.f1, params.b1 * 0.8)
        self.p2.set_params(params.f2, params.b2 * 0.8)
        self.p3.set_params(params.f3, params.b3 * 0.8)
        self.p4.set_params(params.f4, params.b4 * 0.8)

    def _cascade_filter(self, x: float) -> float:
        """Process through cascade of formant resonators."""
        # Nasal coupling
        y = self.rnz.process(x)
        y = self.rnp.process(y)

        # Formant resonators in cascade
        y = self.r1.process(y)
        y = self.r2.process(y)
        y = self.r3.process(y)
        y = self.r4.process(y)
        y = self.r5.process(y)
        y = self.r6.process(y)

        return y

    def _parallel_filter(self, x: float, params: KlattParams) -> float:
        """Process through parallel formant resonators."""
        # Each resonator has its own amplitude
        y1 = self.p1.process(x) * self._db_to_amp(params.a1)
        y2 = self.p2.process(x) * self._db_to_amp(params.a2)
        y3 = self.p3.process(x) * self._db_to_amp(params.a3)
        y4 = self.p4.process(x) * self._db_to_amp(params.a4)

        return y1 + y2 + y3 + y4

    def _db_to_amp(self, db: float) -> float:
        """Convert dB to linear amplitude."""
        if db <= 0:
            return 0.0
        return 10 ** (db / 20.0) / 1000.0  # Normalized

    def reset(self) -> None:
        """Reset all filter states."""
        self.glottal.reset()
        self.r1.reset()
        self.r2.reset()
        self.r3.reset()
        self.r4.reset()
        self.r5.reset()
        self.r6.reset()
        self.rnp.reset()
        self.rnz.reset()
        self.p1.reset()
        self.p2.reset()
        self.p3.reset()
        self.p4.reset()
        self.rad_prev = 0.0
