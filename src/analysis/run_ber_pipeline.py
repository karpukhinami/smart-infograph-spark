"""End-to-end BER pipeline: simulate, save JSON, plot vs theory."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from src.analysis.ber_simulation import BERSimulation, DEFAULT_N_TRIALS, DEFAULT_SEED, DEFAULT_SNR_DB
from src.analysis.plot_comparison import save_plot_comparison

BANDS = ("LF", "HF")
MODULATIONS = ("BPSK", "QPSK", "16QAM", "64QAM")


def run_pipeline(
    output_dir: str | Path = "output/ber",
    snr_db: np.ndarray | None = None,
    n_trials_per_snr: int = DEFAULT_N_TRIALS,
    seed: int = DEFAULT_SEED,
    bands: tuple[str, ...] = BANDS,
    modulations: tuple[str, ...] = MODULATIONS,
) -> dict[str, dict[str, dict[float, float]]]:
    """Run BER simulation for each (band, modulation); save JSON and plots."""
    output_dir = Path(output_dir)
    json_dir = output_dir / "json"
    plot_dir = output_dir / "plots"
    json_dir.mkdir(parents=True, exist_ok=True)
    plot_dir.mkdir(parents=True, exist_ok=True)

    snr = np.asarray(snr_db if snr_db is not None else DEFAULT_SNR_DB, dtype=float)
    all_results: dict[str, dict[str, dict[float, float]]] = {}

    for band in bands:
        all_results[band] = {}
        for mod in modulations:
            sim = BERSimulation(
                band=band,
                modulation=mod,
                snr_db=snr,
                n_trials_per_snr=n_trials_per_snr,
                seed=seed,
            )
            ber_curve = sim.run()
            all_results[band][mod] = ber_curve

            json_path = json_dir / f"ber_{band}_{mod}.json"
            sim.save(json_path)

            plot_path = plot_dir / f"ber_snr_{band}_{mod}.png"
            save_plot_comparison(
                ber_curve,
                str(plot_path),
                snr,
                n_trials_per_snr=n_trials_per_snr,
                modulation=mod,
                band=band,
            )

    return all_results


def main() -> None:
    parser = argparse.ArgumentParser(description="BER simulation pipeline (LF/HF)")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="output/ber",
        help="Root directory for JSON and plots",
    )
    parser.add_argument(
        "--n-trials",
        type=int,
        default=DEFAULT_N_TRIALS,
        help="Monte Carlo trials per SNR point",
    )
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument(
        "--snr-min",
        type=float,
        default=float(DEFAULT_SNR_DB.min()),
    )
    parser.add_argument(
        "--snr-max",
        type=float,
        default=float(DEFAULT_SNR_DB.max()),
    )
    parser.add_argument("--snr-step", type=float, default=2.0)
    args = parser.parse_args()

    snr_db = np.arange(args.snr_min, args.snr_max + 1e-9, args.snr_step, dtype=float)
    run_pipeline(
        output_dir=args.output_dir,
        snr_db=snr_db,
        n_trials_per_snr=args.n_trials,
        seed=args.seed,
    )
    print(f"Done. Results in {args.output_dir}")


if __name__ == "__main__":
    main()
