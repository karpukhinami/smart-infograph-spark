"""BER simulation for infographics channel (LF / HF bands, multiple modulations)."""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np

from src.analysis.ber_theoretical import theoretical_ber
from src.analysis.modulation import ModulationScheme, get_modulation_scheme
from src.analysis.snr import snr_db_to_linear

DEFAULT_SNR_DB = np.arange(-10, 21, 2, dtype=float)
DEFAULT_N_TRIALS = 10_000
DEFAULT_SEED = 42


class BERSimulation:
    """Monte Carlo BER vs SNR for one (band, modulation) pair."""

    def __init__(
        self,
        band: str,
        modulation: str,
        snr_db: np.ndarray | None = None,
        n_trials_per_snr: int = DEFAULT_N_TRIALS,
        seed: int = DEFAULT_SEED,
    ):
        self.band = band
        self.modulation = modulation
        self.snr_db = np.asarray(snr_db if snr_db is not None else DEFAULT_SNR_DB, dtype=float)
        self.n_trials_per_snr = n_trials_per_snr
        self.seed = seed
        self.scheme: ModulationScheme = get_modulation_scheme(modulation)
        self.ber_curves: dict[float, float] = {}

    def _rng(self, snr_point: float) -> random.Random:
        snr_key = int(round(float(snr_point) * 100))
        return random.Random(self.seed + snr_key)

    def _Map(self, snr_db: float) -> float:
        """Simulated BER at one SNR (dB)."""
        snr_linear = snr_db_to_linear(snr_db)
        rng = self._rng(snr_db)
        errors = 0
        bits_per_symbol = self.scheme.bits_per_symbol

        for _ in range(self.n_trials_per_snr):
            bits = [rng.randint(0, 1) for _ in range(bits_per_symbol)]
            tx = self.scheme.modulate(bits)
            rx = self.scheme.add_awgn(tx, snr_linear, rng)
            rx_bits = self.scheme.demodulate(rx)
            for i in range(bits_per_symbol):
                if rx_bits[i] != bits[i]:
                    errors += 1

        return errors / (self.n_trials_per_snr * bits_per_symbol)

    def runMap(self, snr_db: float) -> float:
        """Simulated BER at one SNR point (dB)."""
        return self._Map(snr_db)

    def run(self) -> dict[float, float]:
        """Run simulation for all configured SNR points."""
        self.ber_curves = {}
        for snr in self.snr_db:
            self.ber_curves[float(snr)] = self.runMap(float(snr))
        return self.ber_curves

    def save(self, filepath: str | Path) -> None:
        """Save BER curve to JSON."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "band": self.band,
            "modulation": self.modulation,
            "n_trials_per_snr": self.n_trials_per_snr,
            "seed": self.seed,
            "snr_db": [float(x) for x in self.snr_db],
            "ber": {str(k): v for k, v in self.ber_curves.items()},
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, filepath: str | Path) -> BERSimulation:
        """Load BER curve from JSON."""
        path = Path(filepath)
        data = json.loads(path.read_text(encoding="utf-8"))
        sim = cls(
            band=data["band"],
            modulation=data["modulation"],
            snr_db=np.array(data["snr_db"], dtype=float),
            n_trials_per_snr=data.get("n_trials_per_snr", DEFAULT_N_TRIALS),
            seed=data.get("seed", DEFAULT_SEED),
        )
        sim.ber_curves = {float(k): float(v) for k, v in data["ber"].items()}
        return sim


def run_ber_simulation(
    band: str,
    modulation: str,
    snr_db: np.ndarray | None = None,
    n_trials_per_snr: int = DEFAULT_N_TRIALS,
    seed: int = DEFAULT_SEED,
) -> dict[float, float]:
    """Convenience wrapper: run simulation and return BER curve."""
    sim = BERSimulation(
        band=band,
        modulation=modulation,
        snr_db=snr_db,
        n_trials_per_snr=n_trials_per_snr,
        seed=seed,
    )
    return sim.run()
