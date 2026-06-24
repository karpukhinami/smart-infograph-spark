"""Theoretical BER curves for AWGN (aligned with modulation schemes)."""

from __future__ import annotations

import math

import numpy as np
from scipy.special import erfc

from src.analysis.snr import snr_db_to_linear


def theoretical_ber_bpsk(snr_db: float | np.ndarray) -> float | np.ndarray:
    gamma = snr_db_to_linear(snr_db)
    return 0.5 * erfc(np.sqrt(gamma))


def theoretical_ber_qpsk(snr_db: float | np.ndarray) -> float | np.ndarray:
    gamma = snr_db_to_linear(snr_db)
    return 0.5 * erfc(np.sqrt(gamma / 2.0))


def theoretical_ber_16qam(snr_db: float | np.ndarray) -> float | np.ndarray:
    gamma = snr_db_to_linear(snr_db)
    sqrt_gamma = np.sqrt(gamma) if isinstance(gamma, np.ndarray) else math.sqrt(gamma)
    return (3.0 / 8.0) * erfc(sqrt_gamma / np.sqrt(10.0))


def theoretical_ber_64qam(snr_db: float | np.ndarray) -> float | np.ndarray:
    gamma = snr_db_to_linear(snr_db)
    sqrt_gamma = np.sqrt(gamma) if isinstance(gamma, np.ndarray) else math.sqrt(gamma)
    return (7.0 / 24.0) * erfc(sqrt_gamma / np.sqrt(42.0))


def theoretical_ber(modulation: str, snr_db: float | np.ndarray) -> float | np.ndarray:
    """Return theoretical BER for modulation name at SNR (dB)."""
    key = modulation.upper().replace("-", "")
    if key == "BPSK":
        return theoretical_ber_bpsk(snr_db)
    if key == "QPSK":
        return theoretical_ber_qpsk(snr_db)
    if key in ("16QAM", "QAM16"):
        return theoretical_ber_16qam(snr_db)
    if key in ("64QAM", "QAM64"):
        return theoretical_ber_64qam(snr_db)
    raise ValueError(f"Unknown modulation: {modulation}")
