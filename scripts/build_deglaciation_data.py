"""
Converts the BIRCh deglaciation-age posterior (full_alis_final.nc) into small
static assets the website can serve and interpolate client-side.

Source file is NOT part of this repo (11.8GB, lives in the research Dropbox).
Re-run this script whenever that source model output changes:

    python3 scripts/build_deglaciation_data.py

Outputs (~7MB total):
    assets/data/deglaciation_grid.json  -- metadata (lat/lon vectors, offsets)
    assets/data/deglaciation_grid.bin   -- packed binary arrays (see JSON for layout)

Grid: regular 200x200 lat/lon grid, lat 35-90 N, lon 215-320 E (0-360 convention).
Value: deglaciation age in ka.

Each cell's histogram is computed over ITS OWN range (min/max of that cell's
posterior draws, plus a small pad), not one shared global range. Posterior width
varies a lot across the grid (some cells span ~1.5ka, others 15+ka); a single
global range forced narrow cells into just 2-3 bins out of a fixed budget,
which looked "chunky" when plotted. Per-cell ranges keep the same bin count
per cell (NBINS) always spread across just that cell's own spread, so resolution
scales with the distribution instead of being wasted on cells that don't need it.
Client-side code must sample each cell's own [bin_min, bin_max] to reconstruct
density at any x, rather than assuming a shared bin grid across neighbors.
"""

import json
import struct
from pathlib import Path

import netCDF4 as nc
import numpy as np

SOURCE_NC = "/Users/samuelchester/Library/CloudStorage/Dropbox/Columbia_research/LIS_Margins/BIRCh_Publication/RESULTS/full_alis_final.nc"
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "data"
OUT_JSON = OUT_DIR / "deglaciation_grid.json"
OUT_BIN = OUT_DIR / "deglaciation_grid.bin"

NBINS = 40
CHUNK = 2000  # columns of mu_pred_ka read per chunk (validated: ~1.4s/2000 cols)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    f = nc.Dataset(SOURCE_NC)
    d = f.groups["derived"]

    ny, nx = d.dimensions["y"].size, d.dimensions["x"].size
    ng = d.dimensions["g"].size
    assert ny * nx == ng

    lat_2d = d.variables["lat"][:]
    lon_2d = d.variables["lon"][:]
    lat = np.asarray(lat_2d[:, 0], dtype=np.float64)
    lon = np.asarray(lon_2d[0, :], dtype=np.float64)
    # sanity: confirm regular grid before trusting 1D reduction
    assert np.allclose(lat_2d, lat[:, None], atol=1e-6, equal_nan=True)
    assert np.allclose(lon_2d, lon[None, :], atol=1e-6, equal_nan=True)

    def grid32(name):
        arr = np.ma.filled(d.variables[name][:], np.nan).astype(np.float32)
        return arr.reshape(-1)  # row-major, matches g index

    mean = grid32("mean")
    median = grid32("median")
    std = grid32("std")
    p05 = grid32("p05")
    p16 = grid32("p16")
    p84 = grid32("p84")
    p95 = grid32("p95")
    mask = np.ma.filled(d.variables["inside_mask"][:], 0).astype(np.uint8).reshape(-1)

    hist = np.zeros((ng, NBINS), dtype=np.float32)
    bin_min = np.zeros(ng, dtype=np.float32)
    bin_max = np.zeros(ng, dtype=np.float32)

    mu_var = d.variables["mu_pred_ka"]
    ndraw = mu_var.shape[0]
    print(f"Computing per-cell histograms for {ng} cells from {ndraw} draws each...")

    for start in range(0, ng, CHUNK):
        stop = min(start + CHUNK, ng)
        cols_inside = np.where(mask[start:stop] == 1)[0]
        if len(cols_inside) == 0:
            continue
        chunk = mu_var[:, start:stop][:, cols_inside]  # (ndraw, n_inside_in_chunk)
        chunk = np.ma.filled(chunk, np.nan)
        for j, col in enumerate(cols_inside):
            draws = chunk[:, j]
            draws = draws[~np.isnan(draws)]
            if len(draws) == 0:
                continue
            lo, hi = draws.min(), draws.max()
            pad = max((hi - lo) * 0.05, 0.05)
            lo -= pad
            hi += pad
            edges = np.linspace(lo, hi, NBINS + 1)
            bin_width = edges[1] - edges[0]
            counts, _ = np.histogram(draws, bins=edges)
            total = counts.sum()
            if total == 0:
                continue
            density = counts.astype(np.float64) / total / bin_width  # integrates to 1 over [lo, hi]
            g = start + col
            hist[g] = density.astype(np.float32)
            bin_min[g] = lo
            bin_max[g] = hi
        print(f"  {stop}/{ng} cells done", end="\r")
    print()

    # --- verification: re-derive mean/p05/p95 from stored stats vs recompute for a sample ---
    sample_idx = np.where(mask == 1)[0][:5]
    sample = np.ma.filled(mu_var[:, sample_idx], np.nan)
    recomputed_mean = np.nanmean(sample, axis=0)
    stored_mean = mean[sample_idx]
    max_err = np.nanmax(np.abs(recomputed_mean - stored_mean))
    print(f"Sanity check: max |recomputed_mean - stored_mean| over 5 sample cells = {max_err:.6f} ka")
    assert max_err < 1e-6, "mean mismatch -- check g-index / reshape ordering"

    # --- pack binary blob ---
    # layout, in order: mean, median, std, p05, p16, p84, p95, bin_min, bin_max
    # (float32, ng each), mask (uint8, ng), histogram (float32, ng*NBINS -- cell
    # g's NBINS values are a probability density integrating to 1 over
    # [bin_min[g], bin_max[g]], NOT a shared range across cells)
    arrays = [
        ("mean", mean, "float32"),
        ("median", median, "float32"),
        ("std", std, "float32"),
        ("p05", p05, "float32"),
        ("p16", p16, "float32"),
        ("p84", p84, "float32"),
        ("p95", p95, "float32"),
        ("bin_min", bin_min, "float32"),
        ("bin_max", bin_max, "float32"),
        ("mask", mask, "uint8"),
        ("histogram", hist.reshape(-1), "float32"),
    ]

    offsets = {}
    with open(OUT_BIN, "wb") as fout:
        offset = 0
        for name, arr, dtype in arrays:
            data = arr.tobytes()
            offsets[name] = {"offset": offset, "length": len(arr), "dtype": dtype}
            fout.write(data)
            offset += len(data)

    metadata = {
        "description": "BIRCh deglaciation-age posterior, interpolable grid",
        "units": "ka (thousand years before present)",
        "grid": {"ny": ny, "nx": nx},
        "lat": lat.tolist(),
        "lon": lon.tolist(),
        "lon_convention": "0-360 (subtract 360 for values > 180 to get -180/180 form)",
        "histogram": {
            "nbins": NBINS,
            "note": "each cell has its OWN range -- see the bin_min/bin_max arrays. cell g's NBINS density values span [bin_min[g], bin_max[g]], not a shared range. To combine across cells, evaluate each cell's density as a function of x (0 outside its own [bin_min,bin_max]) and blend those function values, not the raw bin arrays index-by-index.",
        },
        "arrays": offsets,
    }
    with open(OUT_JSON, "w") as fjson:
        json.dump(metadata, fjson)

    bin_mb = OUT_BIN.stat().st_size / 1e6
    json_kb = OUT_JSON.stat().st_size / 1e3
    print(f"Wrote {OUT_BIN} ({bin_mb:.2f} MB) and {OUT_JSON} ({json_kb:.1f} KB)")


if __name__ == "__main__":
    main()
