"""Tests for BER analysis pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.analysis.ber_simulation import BERSimulation, run_ber_simulation
from src.analysis.ber_theoretical import theoretical_ber
from src.analysis.modulation import BPSKScheme, QPSKScheme, get_modulation_scheme
from src.analysis.plot_comparison import PlotComparison, save_plot_comparison
from src.analysis.snr import snr_db_to_linear, snr_linear_to_db


def test_snr_conversion_roundtrip():
    snr_db = 10.0
    linear = snr_db_to_linear(snr_db)
    assert abs(snr_linear_to_db(linear) - snr_db) < 1e-9


def test_bpsk_modulate_demodulate_noiseless():
    scheme = BPSKScheme()
    for bit in (0, 1):
        sym = scheme.modulate([bit])
        assert scheme.demodulate(sym) == [bit]


def test_qpsk_modulate_demodulate_noiseless():
    scheme = QPSKScheme()
    for b0 in (0, 1):
        for b1 in (0, 1):
            bits = [b0, b1]
            assert scheme.demodulate(scheme.modulate(bits)) == bits


def test_get_modulation_scheme_names():
    assert get_modulation_scheme("BPSK").name == "BPSK"
    assert get_modulation_scheme("16QAM").bits_per_symbol == 4


def test_theoretical_ber_monotonic():
    snr = np.array([0.0, 5.0, 10.0, 15.0])
    ber = theoretical_ber("BPSK", snr)
    assert np.all(np.diff(ber) < 0)


def test_ber_simulation_runMap_low_snr():
    sim = BERSimulation(
        band="LF",
        modulation="BPSK",
        snr_db=np.array([0.0]),
        n_trials_per_snr=500,
        seed=1,
    )
    ber = sim.runMap(0.0)
    assert 0.0 <= ber <= 1.0


def test_ber_simulation_save_load(tmp_path):
    sim = BERSimulation(
        band="HF",
        modulation="QPSK",
        snr_db=np.array([-5.0, 0.0, 5.0]),
        n_trials_per_snr=200,
        seed=42,
    )
    sim.run()
    path = tmp_path / "ber_HF_QPSK.json"
    sim.save(path)
    loaded = BERSimulation.load(path)
    assert loaded.band == "HF"
    assert loaded.modulation == "QPSK"
    assert loaded.ber_curves == sim.ber_curves


def test_run_ber_simulation_wrapper():
    curve = run_ber_simulation(
        "LF",
        "BPSK",
        snr_db=np.array([10.0]),
        n_trials_per_snr=300,
        seed=0,
    )
    assert 10.0 in curve or 10 in curve


def test_plot_comparison_save(tmp_path):
    snr = np.array([-5.0, 0.0, 5.0, 10.0])
    ber = {float(s): theoretical_ber("BPSK", s) * 1.1 for s in snr}
    out = tmp_path / "plot.png"
    pc = PlotComparison(snr_db=snr, ber_curves=ber, modulation="BPSK", band="LF")
    pc.plot()
    pc.save(out)
    assert out.exists() and out.stat().st_size > 0


def test_save_plot_comparison_single_mod(tmp_path):
    snr = np.array([0.0, 10.0])
    ber = {0.0: 0.1, 10.0: 0.01}
    out = tmp_path / "ber.png"
    save_plot_comparison(ber, out, snr, modulation="BPSK", band="LF")
    assert out.exists()
