"""
WAV file output - No dependencies, pure Python.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import Union
import array


@dataclass
class Audio:
    """Audio data container."""
    samples: list[float]  # Normalized -1.0 to 1.0
    sample_rate: int = 22050
    channels: int = 1
    bits_per_sample: int = 16

    def __len__(self) -> int:
        return len(self.samples)

    def duration(self) -> float:
        """Duration in seconds."""
        return len(self.samples) / self.sample_rate

    def append(self, other: Audio) -> None:
        """Append another audio."""
        self.samples.extend(other.samples)

    def amplify(self, factor: float) -> None:
        """Amplify by factor."""
        self.samples = [s * factor for s in self.samples]

    def normalize(self) -> None:
        """Normalize to full range."""
        if not self.samples:
            return
        peak = max(abs(s) for s in self.samples)
        if peak > 0:
            self.samples = [s / peak for s in self.samples]

    def fade_in(self, duration: float) -> None:
        """Apply fade in."""
        samples_count = int(duration * self.sample_rate)
        for i in range(min(samples_count, len(self.samples))):
            self.samples[i] *= i / samples_count

    def fade_out(self, duration: float) -> None:
        """Apply fade out."""
        samples_count = int(duration * self.sample_rate)
        start = max(0, len(self.samples) - samples_count)
        for i in range(start, len(self.samples)):
            self.samples[i] *= (len(self.samples) - i) / samples_count


def save_wav(filename: str, audio: Audio) -> None:
    """
    Save audio to WAV file.

    Pure Python implementation - no dependencies.

    Args:
        filename: Output file path
        audio: Audio data to save
    """
    sample_rate = audio.sample_rate
    channels = audio.channels
    bits_per_sample = audio.bits_per_sample
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    # Convert float samples to int16
    max_val = 2 ** (bits_per_sample - 1) - 1
    int_samples = []
    for sample in audio.samples:
        # Clip to range
        clipped = max(-1.0, min(1.0, sample))
        int_samples.append(int(clipped * max_val))

    # Pack samples
    if bits_per_sample == 16:
        fmt = f"<{len(int_samples)}h"
        data = struct.pack(fmt, *int_samples)
    elif bits_per_sample == 8:
        # 8-bit is unsigned
        data = bytes(s + 128 for s in int_samples)
    else:
        raise ValueError(f"Unsupported bits_per_sample: {bits_per_sample}")

    data_size = len(data)
    file_size = 36 + data_size

    with open(filename, "wb") as f:
        # RIFF header
        f.write(b"RIFF")
        f.write(struct.pack("<I", file_size))
        f.write(b"WAVE")

        # fmt chunk
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))  # Chunk size
        f.write(struct.pack("<H", 1))   # Audio format (PCM)
        f.write(struct.pack("<H", channels))
        f.write(struct.pack("<I", sample_rate))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", block_align))
        f.write(struct.pack("<H", bits_per_sample))

        # data chunk
        f.write(b"data")
        f.write(struct.pack("<I", data_size))
        f.write(data)


def load_wav(filename: str) -> Audio:
    """
    Load audio from WAV file.

    Args:
        filename: Input file path

    Returns:
        Audio data
    """
    with open(filename, "rb") as f:
        # RIFF header
        riff = f.read(4)
        if riff != b"RIFF":
            raise ValueError("Not a WAV file")

        file_size = struct.unpack("<I", f.read(4))[0]
        wave = f.read(4)
        if wave != b"WAVE":
            raise ValueError("Not a WAV file")

        # Find fmt chunk
        sample_rate = 22050
        channels = 1
        bits_per_sample = 16

        while True:
            chunk_id = f.read(4)
            if len(chunk_id) < 4:
                break

            chunk_size = struct.unpack("<I", f.read(4))[0]

            if chunk_id == b"fmt ":
                audio_format = struct.unpack("<H", f.read(2))[0]
                channels = struct.unpack("<H", f.read(2))[0]
                sample_rate = struct.unpack("<I", f.read(4))[0]
                byte_rate = struct.unpack("<I", f.read(4))[0]
                block_align = struct.unpack("<H", f.read(2))[0]
                bits_per_sample = struct.unpack("<H", f.read(2))[0]
                # Skip rest of fmt chunk
                f.read(chunk_size - 16)

            elif chunk_id == b"data":
                data = f.read(chunk_size)
                break

            else:
                f.read(chunk_size)

        # Unpack samples
        max_val = 2 ** (bits_per_sample - 1)

        if bits_per_sample == 16:
            n_samples = len(data) // 2
            int_samples = struct.unpack(f"<{n_samples}h", data)
            samples = [s / max_val for s in int_samples]
        elif bits_per_sample == 8:
            samples = [(b - 128) / 128 for b in data]
        else:
            raise ValueError(f"Unsupported bits: {bits_per_sample}")

        return Audio(
            samples=list(samples),
            sample_rate=sample_rate,
            channels=channels,
            bits_per_sample=bits_per_sample,
        )
