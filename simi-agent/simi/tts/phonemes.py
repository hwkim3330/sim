"""
Phoneme database and text-to-phoneme conversion.

Based on ARPAbet phoneme set with formant parameters.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import re


@dataclass
class Phoneme:
    """
    Phoneme with acoustic parameters.

    Formant frequencies (F1-F4) and bandwidths define vowel quality.
    Voicing, aspiration, and frication control consonant characteristics.
    """
    symbol: str           # ARPAbet symbol
    duration: int         # Duration in milliseconds
    f1: int              # First formant frequency (Hz)
    f2: int              # Second formant frequency (Hz)
    f3: int              # Third formant frequency (Hz)
    f4: int              # Fourth formant frequency (Hz)
    b1: int              # First formant bandwidth (Hz)
    b2: int              # Second formant bandwidth (Hz)
    b3: int              # Third formant bandwidth (Hz)
    b4: int              # Fourth formant bandwidth (Hz)
    f0: int              # Fundamental frequency (Hz)
    av: int              # Voicing amplitude (0-80 dB)
    ah: int              # Aspiration amplitude (0-80 dB)
    af: int              # Frication amplitude (0-80 dB)
    voiced: bool         # Is voiced?


class PhonemeDB:
    """
    Database of phonemes with formant parameters.

    Based on Klatt 1980 default values and ARPAbet.
    """

    # Default pitch
    DEFAULT_F0 = 120

    # Phoneme definitions: (f1, f2, f3, f4, b1, b2, b3, b4, duration, av, voiced)
    # Values based on Klatt 1980 and Peterson & Barney 1952
    PHONEMES = {
        # Vowels (monophthongs)
        "IY": (270, 2290, 3010, 3500, 60, 90, 150, 200, 120, 60, True),   # beat
        "IH": (390, 1990, 2550, 3500, 60, 90, 150, 200, 100, 60, True),   # bit
        "EH": (530, 1840, 2480, 3500, 60, 90, 150, 200, 100, 60, True),   # bet
        "EY": (440, 2100, 2600, 3500, 60, 90, 150, 200, 140, 60, True),   # bait
        "AE": (660, 1720, 2410, 3500, 60, 90, 150, 200, 120, 60, True),   # bat
        "AA": (730, 1090, 2440, 3500, 60, 90, 150, 200, 120, 60, True),   # father
        "AO": (570, 840, 2410, 3500, 60, 90, 150, 200, 120, 60, True),    # bought
        "OW": (490, 1350, 2400, 3500, 60, 90, 150, 200, 140, 60, True),   # boat
        "UH": (440, 1020, 2240, 3500, 60, 90, 150, 200, 100, 60, True),   # book
        "UW": (300, 870, 2240, 3500, 60, 90, 150, 200, 120, 60, True),    # boot
        "AH": (640, 1190, 2390, 3500, 60, 90, 150, 200, 100, 60, True),   # but
        "AX": (500, 1500, 2500, 3500, 60, 90, 150, 200, 60, 50, True),    # schwa

        # R-colored vowels
        "ER": (490, 1350, 1690, 3500, 60, 90, 150, 200, 120, 60, True),   # bird
        "AXR": (500, 1300, 1700, 3500, 60, 90, 150, 200, 80, 50, True),   # butter

        # Diphthongs
        "AY": (730, 1090, 2440, 3500, 60, 90, 150, 200, 180, 60, True),   # bite
        "AW": (730, 1090, 2440, 3500, 60, 90, 150, 200, 180, 60, True),   # bout
        "OY": (570, 840, 2410, 3500, 60, 90, 150, 200, 180, 60, True),    # boy

        # Stops (voiced)
        "B": (200, 1100, 2150, 3500, 60, 90, 150, 200, 60, 60, True),
        "D": (200, 1600, 2600, 3500, 60, 90, 150, 200, 60, 60, True),
        "G": (200, 1990, 2850, 3500, 60, 90, 150, 200, 60, 60, True),

        # Stops (unvoiced)
        "P": (200, 1100, 2150, 3500, 200, 200, 200, 200, 80, 0, False),
        "T": (200, 1600, 2600, 3500, 200, 200, 200, 200, 80, 0, False),
        "K": (200, 1990, 2850, 3500, 200, 200, 200, 200, 80, 0, False),

        # Fricatives (voiced)
        "V": (220, 1100, 2080, 3500, 60, 90, 150, 200, 80, 50, True),
        "DH": (200, 1600, 2600, 3500, 60, 90, 150, 200, 60, 50, True),    # the
        "Z": (200, 1600, 2600, 3500, 60, 90, 150, 200, 80, 50, True),
        "ZH": (200, 1900, 2500, 3500, 60, 90, 150, 200, 80, 50, True),    # measure

        # Fricatives (unvoiced)
        "F": (220, 1100, 2080, 3500, 200, 200, 200, 200, 100, 0, False),
        "TH": (200, 1600, 2600, 3500, 200, 200, 200, 200, 80, 0, False),  # think
        "S": (200, 1600, 2600, 3500, 200, 200, 200, 200, 100, 0, False),
        "SH": (200, 1900, 2500, 3500, 200, 200, 200, 200, 100, 0, False),
        "HH": (500, 1500, 2500, 3500, 200, 200, 200, 200, 60, 0, False),  # hat

        # Affricates
        "CH": (200, 1900, 2500, 3500, 200, 200, 200, 200, 120, 0, False), # church
        "JH": (200, 1900, 2500, 3500, 60, 90, 150, 200, 100, 50, True),   # judge

        # Nasals
        "M": (270, 1000, 2200, 3500, 60, 90, 150, 200, 80, 60, True),
        "N": (270, 1600, 2600, 3500, 60, 90, 150, 200, 80, 60, True),
        "NG": (270, 1990, 2850, 3500, 60, 90, 150, 200, 80, 60, True),

        # Liquids
        "L": (310, 1050, 2880, 3500, 60, 90, 150, 200, 80, 60, True),
        "R": (310, 1060, 1380, 3500, 60, 90, 150, 200, 80, 60, True),

        # Glides
        "W": (290, 610, 2150, 3500, 60, 90, 150, 200, 60, 60, True),
        "Y": (260, 2070, 3020, 3500, 60, 90, 150, 200, 60, 60, True),

        # Silence
        "SIL": (0, 0, 0, 0, 200, 200, 200, 200, 100, 0, False),
        "PAU": (0, 0, 0, 0, 200, 200, 200, 200, 150, 0, False),
    }

    def __init__(self, default_f0: int = 120):
        self.default_f0 = default_f0

    def get(self, symbol: str) -> Optional[Phoneme]:
        """Get phoneme by ARPAbet symbol."""
        symbol = symbol.upper()
        if symbol not in self.PHONEMES:
            return None

        f1, f2, f3, f4, b1, b2, b3, b4, dur, av, voiced = self.PHONEMES[symbol]
        return Phoneme(
            symbol=symbol,
            duration=dur,
            f1=f1, f2=f2, f3=f3, f4=f4,
            b1=b1, b2=b2, b3=b3, b4=b4,
            f0=self.default_f0,
            av=av,
            ah=20 if not voiced else 0,
            af=40 if symbol in ("S", "SH", "F", "TH", "HH", "CH") else 0,
            voiced=voiced,
        )


class TextToPhoneme:
    """
    Convert English text to ARPAbet phonemes.

    Rule-based approach with letter-to-sound rules.
    """

    # Letter to phoneme mapping (simplified)
    LETTER_MAP = {
        'a': ['AE'],
        'b': ['B'],
        'c': ['K'],  # Default, 's' before e/i
        'd': ['D'],
        'e': ['EH'],
        'f': ['F'],
        'g': ['G'],
        'h': ['HH'],
        'i': ['IH'],
        'j': ['JH'],
        'k': ['K'],
        'l': ['L'],
        'm': ['M'],
        'n': ['N'],
        'o': ['AA'],
        'p': ['P'],
        'q': ['K', 'W'],
        'r': ['R'],
        's': ['S'],
        't': ['T'],
        'u': ['AH'],
        'v': ['V'],
        'w': ['W'],
        'x': ['K', 'S'],
        'y': ['Y'],
        'z': ['Z'],
    }

    # Common word dictionary (for irregular pronunciations)
    DICTIONARY = {
        "the": ["DH", "AX"],
        "a": ["AX"],
        "an": ["AE", "N"],
        "and": ["AE", "N", "D"],
        "to": ["T", "UW"],
        "of": ["AH", "V"],
        "in": ["IH", "N"],
        "is": ["IH", "Z"],
        "it": ["IH", "T"],
        "you": ["Y", "UW"],
        "that": ["DH", "AE", "T"],
        "he": ["HH", "IY"],
        "was": ["W", "AA", "Z"],
        "for": ["F", "AO", "R"],
        "on": ["AA", "N"],
        "are": ["AA", "R"],
        "with": ["W", "IH", "DH"],
        "as": ["AE", "Z"],
        "his": ["HH", "IH", "Z"],
        "they": ["DH", "EY"],
        "be": ["B", "IY"],
        "at": ["AE", "T"],
        "one": ["W", "AH", "N"],
        "have": ["HH", "AE", "V"],
        "this": ["DH", "IH", "S"],
        "from": ["F", "R", "AH", "M"],
        "or": ["AO", "R"],
        "had": ["HH", "AE", "D"],
        "by": ["B", "AY"],
        "not": ["N", "AA", "T"],
        "but": ["B", "AH", "T"],
        "what": ["W", "AH", "T"],
        "all": ["AO", "L"],
        "were": ["W", "ER"],
        "we": ["W", "IY"],
        "when": ["W", "EH", "N"],
        "your": ["Y", "AO", "R"],
        "can": ["K", "AE", "N"],
        "said": ["S", "EH", "D"],
        "there": ["DH", "EH", "R"],
        "use": ["Y", "UW", "Z"],
        "each": ["IY", "CH"],
        "which": ["W", "IH", "CH"],
        "she": ["SH", "IY"],
        "do": ["D", "UW"],
        "how": ["HH", "AW"],
        "their": ["DH", "EH", "R"],
        "if": ["IH", "F"],
        "will": ["W", "IH", "L"],
        "up": ["AH", "P"],
        "other": ["AH", "DH", "ER"],
        "about": ["AX", "B", "AW", "T"],
        "out": ["AW", "T"],
        "many": ["M", "EH", "N", "IY"],
        "then": ["DH", "EH", "N"],
        "them": ["DH", "EH", "M"],
        "these": ["DH", "IY", "Z"],
        "so": ["S", "OW"],
        "some": ["S", "AH", "M"],
        "her": ["HH", "ER"],
        "would": ["W", "UH", "D"],
        "make": ["M", "EY", "K"],
        "like": ["L", "AY", "K"],
        "him": ["HH", "IH", "M"],
        "into": ["IH", "N", "T", "UW"],
        "time": ["T", "AY", "M"],
        "has": ["HH", "AE", "Z"],
        "look": ["L", "UH", "K"],
        "two": ["T", "UW"],
        "more": ["M", "AO", "R"],
        "go": ["G", "OW"],
        "see": ["S", "IY"],
        "no": ["N", "OW"],
        "way": ["W", "EY"],
        "could": ["K", "UH", "D"],
        "my": ["M", "AY"],
        "than": ["DH", "AE", "N"],
        "first": ["F", "ER", "S", "T"],
        "been": ["B", "IH", "N"],
        "call": ["K", "AO", "L"],
        "who": ["HH", "UW"],
        "its": ["IH", "T", "S"],
        "now": ["N", "AW"],
        "find": ["F", "AY", "N", "D"],
        "long": ["L", "AO", "NG"],
        "down": ["D", "AW", "N"],
        "day": ["D", "EY"],
        "did": ["D", "IH", "D"],
        "get": ["G", "EH", "T"],
        "come": ["K", "AH", "M"],
        "made": ["M", "EY", "D"],
        "may": ["M", "EY"],
        "part": ["P", "AA", "R", "T"],
        "hello": ["HH", "AX", "L", "OW"],
        "world": ["W", "ER", "L", "D"],
        "yes": ["Y", "EH", "S"],
        "know": ["N", "OW"],
        "think": ["TH", "IH", "NG", "K"],
        "just": ["JH", "AH", "S", "T"],
        "good": ["G", "UH", "D"],
        "new": ["N", "UW"],
        "want": ["W", "AA", "N", "T"],
        "because": ["B", "IH", "K", "AO", "Z"],
        "any": ["EH", "N", "IY"],
        "give": ["G", "IH", "V"],
        "most": ["M", "OW", "S", "T"],
        "only": ["OW", "N", "L", "IY"],
    }

    # Digraph rules
    DIGRAPHS = {
        "th": ["TH"],
        "sh": ["SH"],
        "ch": ["CH"],
        "ph": ["F"],
        "wh": ["W"],
        "ng": ["NG"],
        "ck": ["K"],
        "gh": [],  # Silent in most cases
        "wr": ["R"],
        "kn": ["N"],
        "qu": ["K", "W"],
        "ee": ["IY"],
        "ea": ["IY"],
        "oo": ["UW"],
        "ou": ["AW"],
        "ow": ["OW"],
        "oi": ["OY"],
        "oy": ["OY"],
        "ai": ["EY"],
        "ay": ["EY"],
        "ie": ["IY"],
        "ey": ["IY"],
    }

    def convert(self, text: str) -> list[str]:
        """
        Convert text to phoneme sequence.

        Args:
            text: Input text

        Returns:
            List of ARPAbet phoneme symbols
        """
        text = text.lower().strip()
        words = re.findall(r"[a-z']+|[.,!?;:]|\s+", text)

        phonemes: list[str] = []

        for word in words:
            if not word or word.isspace():
                continue

            if word in ".,!?;:":
                phonemes.append("PAU")
                continue

            # Check dictionary first
            if word in self.DICTIONARY:
                phonemes.extend(self.DICTIONARY[word])
            else:
                phonemes.extend(self._convert_word(word))

            # Add small pause between words
            phonemes.append("SIL")

        # Add final pause
        if phonemes and phonemes[-1] != "PAU":
            phonemes.append("PAU")

        return phonemes

    def _convert_word(self, word: str) -> list[str]:
        """Convert single word to phonemes using rules."""
        phonemes: list[str] = []
        i = 0

        while i < len(word):
            # Skip apostrophes
            if word[i] == "'":
                i += 1
                continue

            # Check digraphs first
            matched = False
            for digraph, phones in self.DIGRAPHS.items():
                if word[i:i+len(digraph)] == digraph:
                    phonemes.extend(phones)
                    i += len(digraph)
                    matched = True
                    break

            if matched:
                continue

            # Single letter rules
            letter = word[i]
            if letter in self.LETTER_MAP:
                # Context-sensitive rules
                if letter == 'c' and i + 1 < len(word) and word[i+1] in 'eiy':
                    phonemes.append('S')
                elif letter == 'g' and i + 1 < len(word) and word[i+1] in 'eiy':
                    phonemes.append('JH')
                elif letter == 'e' and i == len(word) - 1:
                    # Silent final e
                    pass
                else:
                    phonemes.extend(self.LETTER_MAP[letter])

            i += 1

        return phonemes
