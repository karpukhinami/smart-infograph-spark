"""Modulation schemes for BER simulation (AWGN channel)."""

from __future__ import annotations

import math
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class ComplexSymbol:
    i: float
    q: float


class ModulationScheme(ABC):
    """Base class: modulate bits, add AWGN, demodulate."""

    name: str
    bits_per_symbol: int

    @abstractmethod
    def modulate(self, bits: list[int]) -> ComplexSymbol:
        raise NotImplementedError

    @abstractmethod
    def demodulate(self, symbol: ComplexSymbol) -> list[int]:
        raise NotImplementedError

    def add_awgn(
        self,
        symbol: ComplexSymbol,
        snr_linear: float,
        rng: random.Random | None = None,
    ) -> ComplexSymbol:
        """Add complex AWGN; SNR = E_s/N_0 per complex symbol."""
        if rng is None:
            rng = random.Random()
        if snr_linear <= 0:
            snr_linear = 1e-12
        noise_std = math.sqrt(0.5 / snr_linear)
        ni = rng.gauss(0.0, noise_std)
        nq = rng.gauss(0.0, noise_std)
        return ComplexSymbol(symbol.i + ni, symbol.q + nq)


class BPSKScheme(ModulationScheme):
    name = "BPSK"
    bits_per_symbol = 1

    def modulate(self, bits: list[int]) -> ComplexSymbol:
        return ComplexSymbol(1.0 if bits[0] == 0 else -1.0, 0.0)

    def demodulate(self, symbol: ComplexSymbol) -> list[int]:
        return [0 if symbol.i >= 0 else 1]


class QPSKScheme(ModulationScheme):
    name = "QPSK"
    bits_per_symbol = 2

    _MAP = {
        (0, 0): ComplexSymbol(1.0, 1.0),
        (0, 1): ComplexSymbol(-1.0, 1.0),
        (1, 1): ComplexSymbol(-1.0, -1.0),
        (1, 0): ComplexSymbol(1.0, -1.0),
    }

    def modulate(self, bits: list[int]) -> ComplexSymbol:
        key = (bits[0], bits[1])
        s = self._MAP[key]
        norm = math.sqrt(2.0)
        return ComplexSymbol(s.i / norm, s.q / norm)

    def demodulate(self, symbol: ComplexSymbol) -> list[int]:
        b0 = 0 if symbol.i >= 0 else 1
        b1 = 0 if symbol.q >= 0 else 1
        return [b0, b1]


class QAM16Scheme(ModulationScheme):
    name = "16QAM"
    bits_per_symbol = 4

    _LEVELS = (-3.0, -1.0, 1.0, 3.0)
    _MAP: dict[tuple[int, int, int, int], ComplexSymbol] = {}

    @classmethod
    def _build_map(cls) -> None:
        if cls._MAP:
            return
        for i, (b0, b1) in enumerate([(0, 0), (0, 1), (1, 1), (1, 0)]):
            for j, (b2, b3) in enumerate([(0, 0), (0, 1), (1, 1), (1, 0)]):
                cls._MAP[(b0, b1, b2, b3)] = ComplexSymbol(
                    cls._LEVELS[i], cls._LEVELS[j]
                )

    def modulate(self, bits: list[int]) -> ComplexSymbol:
        self._build_map()
        key = (bits[0], bits[1], bits[2], bits[3])
        s = self._MAP[key]
        norm = math.sqrt(10.0)
        return ComplexSymbol(s.i / norm, s.q / norm)

    def demodulate(self, symbol: ComplexSymbol) -> list[int]:
        self._build_map()
        best_key = None
        best_dist = float("inf")
        for key, ref in self._MAP.items():
            d = (symbol.i - ref.i / math.sqrt(10.0)) ** 2 + (
                symbol.q - ref.q / math.sqrt(10.0)
            ) ** 2
            if d < best_dist:
                best_dist = d
                best_key = key
        return list(best_key)


class QAM64Scheme(ModulationScheme):
    name = "64QAM"
    bits_per_symbol = 6

    _LEVELS = (-7.0, -5.0, -3.0, -1.0, 1.0, 3.0, 5.0, 7.0)
    _MAP: dict[tuple[int, ...], ComplexSymbol] = {}

    @classmethod
    def _build_map(cls) -> None:
        if cls._MAP:
            return
        gray3 = [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1), (1, 0, 0)]
        for i, b_i in enumerate(gray3):
            for j, b_q in enumerate(gray3):
                cls._MAP[tuple(b_i + b_q)] = ComplexSymbol(
                    cls._LEVELS[i], cls._LEVELS[j]
                )

    def modulate(self, bits: list[int]) -> ComplexSymbol:
        self._build_map()
        key = tuple(bits)
        s = self._MAP[key]
        norm = math.sqrt(42.0)
        return ComplexSymbol(s.i / norm, s.q / norm)

    def demodulate(self, symbol: ComplexSymbol) -> list[int]:
        self._build_map()
        best_key = None
        best_dist = float("inf")
        for key, ref in self._MAP.items():
            d = (symbol.i - ref.i / math.sqrt(42.0)) ** 2 + (
                symbol.q - ref.q / math.sqrt(42.0)
            ) ** 2
            if d < best_dist:
                best_dist = d
                best_key = key
        return list(best_key)


def get_modulation_scheme(name: str) -> ModulationScheme:
    key = name.upper().replace("-", "")
    schemes: dict[str, ModulationScheme] = {
        "BPSK": BPSKScheme(),
        "QPSK": QPSKScheme(),
        "16QAM": QAM16Scheme(),
        "QAM16": QAM16Scheme(),
        "64QAM": QAM64Scheme(),
        "QAM64": QAM64Scheme(),
    }
    if key not in schemes:
        raise ValueError(f"Unknown modulation: {name}")
    return schemes[key]
