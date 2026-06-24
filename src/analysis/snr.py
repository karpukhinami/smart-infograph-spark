"""SNR helpers for BER analysis."""

from __future__ import annotations

import numpy as np


def snr_db_to_linear(snr_db: float | np.ndarray) -> float | np.ndarray:
    """Convert SNR from dB to linear scale (power ratio)."""
    return 10.0 ** (np.asarray(snr_db, dtype=float) / 10.0)


def snr_linear_to_db(snr_linear: float | np.ndarray) -> float | np.ndarray:
    """Convert linear SNR to dB."""
    x = np.asarray(snr_linear, dtype=float)
    x = np.maximum(x, 1e-300)
    return 10.0 * np.log10(x)
