"""Plot simulated BER vs theoretical curves."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from src.analysis.ber_theoretical import theoretical_ber


class PlotComparison:
    """BER vs SNR: Monte Carlo vs theory for one (band, modulation)."""

    def __init__(
        self,
        snr_db: np.ndarray,
        ber_curves: dict[float, float],
        title: str = "BER vs SNR Comparison",
        n_trials_per_snr: int | None = None,
        band: str | None = None,
        modulation: str | None = None,
    ):
        self.snr_db = np.asarray(snr_db, dtype=float)
        self.ber_curves = ber_curves
        self.title = title
        self.n_trials_per_snr = n_trials_per_snr
        self.band = band
        self.modulation = modulation
        self.fig: plt.Figure | None = None
        self.ax: plt.Axes | None = None

    def _setup_figure(self) -> None:
        self.fig, self.ax = plt.subplots(figsize=(10, 6))
        parts = [self.title]
        if self.band:
            parts.append(f"band={self.band}")
        if self.modulation:
            parts.append(f"mod={self.modulation}")
        if self.n_trials_per_snr is not None:
            parts.append(f"trials/SNR={self.n_trials_per_snr}")
        self.ax.set_title(" — ".join(parts))
        self.ax.set_xlabel("SNR (dB)")
        self.ax.set_ylabel("Bit Error Rate (BER)")
        self.ax.set_yscale("log")
        self.ax.grid(True, which="both", linestyle="--", alpha=0.5)

    def plot(self, modulation: str | None = None) -> plt.Figure:
        """Draw simulated and theoretical BER curves."""
        mod = modulation or self.modulation
        if mod is None:
            raise ValueError("modulation must be set on PlotComparison or passed to plot()")

        self._setup_figure()
        assert self.ax is not None

        snr_sorted = sorted(self.ber_curves.keys())
        ber_sim = [max(self.ber_curves[s], 1e-12) for s in snr_sorted]
        snr_arr = np.array(snr_sorted, dtype=float)

        self.ax.semilogy(
            snr_arr,
            ber_sim,
            "o-",
            label=f"Simulated ({mod})",
            linewidth=2,
            markersize=6,
        )

        theory = np.array(
            [max(float(theoretical_ber(mod, s)), 1e-12) for s in snr_arr],
            dtype=float,
        )
        self.ax.semilogy(
            snr_arr,
            theory,
            "--",
            label=f"Theoretical ({mod})",
            linewidth=2,
        )

        self.ax.legend(loc="best")
        plt.tight_layout()
        return self.fig

    def save(self, filepath: str | Path, fig: plt.Figure | None = None) -> None:
        target = fig or self.fig
        if target is None:
            raise RuntimeError("Call plot() before save()")
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        target.savefig(path, dpi=300, bbox_inches="tight")
        plt.close(target)


def save_plot_comparison(
    ber_curves_dict,
    save_path: str | Path,
    snr_db: np.ndarray,
    n_trials_per_snr: int | None = None,
    modulation: str | None = None,
    band: str | None = None,
) -> None:
    """Save one BER plot, or one PNG per modulation if ber_curves_dict is nested."""
    snr_db = np.asarray(snr_db, dtype=float)

    if modulation is not None:
        pc = PlotComparison(
            snr_db=snr_db,
            ber_curves=ber_curves_dict,
            title="BER vs SNR Comparison",
            n_trials_per_snr=n_trials_per_snr,
            band=band,
            modulation=modulation,
        )
        pc.plot()
        pc.save(save_path)
        return

    out_dir = Path(save_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    for mod_name, ber_dict in ber_curves_dict.items():
        if not ber_dict:
            continue
        plotter = PlotComparison(
            snr_db=snr_db,
            ber_curves=ber_dict,
            title=f"BER vs SNR — {mod_name}",
            n_trials_per_snr=n_trials_per_snr,
            band=band,
            modulation=mod_name,
        )
        plotter.plot()
        plotter.save(out_dir / f"ber_snr_{mod_name}.png")
