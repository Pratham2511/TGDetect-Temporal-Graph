"""TG-Detect training on Modal (GPU).

Local machine only uploads the code + the processed graph (parquet). All heavy
work (snapshot building, training, evaluation) runs on a Modal GPU container.

Usage (see MODAL_GUIDE.md for the full walkthrough):

    modal run modal_train.py::upload   --local-dir data/processed/mordor_mixed \
                                       --remote-name mordor_mixed
    modal run modal_train.py::snapshots --name mordor_mixed --window-size 60 --stride 30
    modal run modal_train.py::train     --name mordor_mixed --epochs 50
    modal run modal_train.py::download  --name mordor_mixed --local-dir results/
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import modal

APP_NAME = "tgdetect"
REMOTE_CODE = "/root/tgdetect"
REMOTE_DATA = "/data"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install(
        "torch==2.5.1",
        "torch-geometric>=2.6",
        "numpy>=1.26",
        "pandas>=2.1",
        "pyarrow>=15",
        "scikit-learn>=1.4",
        "orjson>=3.9",
        "networkx>=3.2",
        "tqdm>=4.66",
        "matplotlib>=3.8",
        "pyvis>=0.3.2",
    )
    .add_local_dir(
        ".",
        REMOTE_CODE,
        ignore=[
            "data/**", "node_modules/**", ".git/**", "**/__pycache__/**",
            "reports/**", "models/checkpoints/**", "*.zip",
        ],
    )
)

app = modal.App(APP_NAME, image=image)
volume = modal.Volume.from_name("tgdetect-data", create_if_missing=True)


def _run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    proc = subprocess.run(cmd, cwd=REMOTE_CODE, env={**os.environ, "PYTHONPATH": REMOTE_CODE})
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


# ---------------------------------------------------------------- data upload
@app.local_entrypoint()
def upload(local_dir: str, remote_name: str) -> None:
    """Upload a processed graph directory (parquet files) into the volume."""
    src = Path(local_dir)
    if not src.exists():
        raise SystemExit(f"not found: {src}")
    with volume.batch_upload(force=True) as batch:
        for f in sorted(src.rglob("*")):
            if f.is_file():
                batch.put_file(f, f"/processed/{remote_name}/{f.relative_to(src).as_posix()}")
                print("uploaded", f.name)
    print(f"done -> volume:/processed/{remote_name}")


@app.local_entrypoint()
def upload_raw(local_dir: str, remote_name: str = "mordor") -> None:
    """Upload the RAW dataset folder (logs/archives) into the volume.

    Example:
        modal run modal_train.py::upload_raw \
            --local-dir data/raw/mordor/Security-Datasets/datasets \
            --remote-name mordor
    """
    src = Path(local_dir)
    if not src.exists():
        raise SystemExit(f"not found: {src}")
    n = 0
    with volume.batch_upload(force=True) as batch:
        for f in sorted(src.rglob("*")):
            if f.is_file():
                batch.put_file(f, f"/raw/{remote_name}/{f.relative_to(src).as_posix()}")
                n += 1
    print(f"uploaded {n} files -> volume:/raw/{remote_name}")


@app.local_entrypoint()
def download(name: str, local_dir: str = "results") -> None:
    """Download checkpoints + metrics back to the local machine."""
    out = Path(local_dir) / name
    out.mkdir(parents=True, exist_ok=True)
    for entry in volume.iterdir(f"/checkpoints/{name}", recursive=True):
        if entry.type.name != "FILE":
            continue
        rel = entry.path.split(f"/checkpoints/{name}/", 1)[-1]
        target = out / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as fh:
            for chunk in volume.read_file(entry.path):
                fh.write(chunk)
        print("downloaded", rel)
    print(f"done -> {out}")


@app.local_entrypoint()
def download_graph(name: str, local_dir: str = "data/processed") -> None:
    """Download a processed graph (parquet) built on Modal back to local."""
    out = Path(local_dir) / name
    out.mkdir(parents=True, exist_ok=True)
    for entry in volume.iterdir(f"/processed/{name}", recursive=True):
        if entry.type.name != "FILE":
            continue
        rel = entry.path.split(f"/processed/{name}/", 1)[-1]
        target = out / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as fh:
            for chunk in volume.read_file(entry.path):
                fh.write(chunk)
        print("downloaded", rel)
    print(f"done -> {out}")



# ------------------------------------------------------------------ remote fns
@app.function(volumes={REMOTE_DATA: volume}, timeout=60 * 60 * 8, cpu=16.0, memory=65536)
def _build(input_rel: str, out_name: str, source_tag: str, label_mode: str,
           label: int, label_window: int, chunk_size: int, extra: str) -> None:
    """Run scripts/build_graph.py on Modal against raw data in the volume."""
    cmd = [
        "python", "scripts/build_graph.py", "--dataset", "mordor",
        "--input", f"{REMOTE_DATA}/raw/{input_rel}",
        "--out", f"{REMOTE_DATA}/processed/{out_name}",
        "--source-tag", source_tag,
        "--label-mode", label_mode,
        "--chunk-size", str(chunk_size),
    ]
    if label_mode == "force":
        cmd += ["--label", str(label)]
    if label_mode == "heuristic":
        cmd += ["--label-window", str(label_window)]
    cmd += [t for t in extra.split() if t]
    _run(cmd)
    volume.commit()


@app.function(volumes={REMOTE_DATA: volume}, timeout=60 * 60 * 4, cpu=16.0, memory=65536)
def _merge(names: str, out_name: str) -> None:
    inputs = [f"{REMOTE_DATA}/processed/{n}" for n in names.split(",") if n]
    _run(["python", "scripts/merge_graphs.py", "--inputs", *inputs,
          "--out", f"{REMOTE_DATA}/processed/{out_name}"])
    volume.commit()


@app.function(volumes={REMOTE_DATA: volume}, timeout=60 * 60 * 4, cpu=8.0, memory=32768)
def _snapshots(name: str, window_size: int, stride: int, max_snapshots: int) -> None:
    sys.path.insert(0, REMOTE_CODE)
    cmd = [
        "python", "scripts/build_snapshots.py",
        "--data", f"{REMOTE_DATA}/processed/{name}",
        "--out", f"{REMOTE_DATA}/snapshots/{name}",
        "--window-size", str(window_size),
        "--stride", str(stride),
    ]
    if max_snapshots:
        cmd += ["--max-snapshots", str(max_snapshots)]
    _run(cmd)
    volume.commit()


@app.function(gpu="A10G", volumes={REMOTE_DATA: volume}, timeout=60 * 60 * 6, memory=32768)
def _train(name: str, epochs: int, hidden: int, lr: float, extra: str) -> None:
    _run(["nvidia-smi"])
    cmd = [
        "python", "scripts/train_tgnn.py",
        "--snapshots", f"{REMOTE_DATA}/snapshots/{name}",
        "--out", f"{REMOTE_DATA}/checkpoints/{name}",
        "--epochs", str(epochs),
        "--hidden-channels", str(hidden),
        "--lr", str(lr),
    ] + [t for t in extra.split() if t]
    _run(cmd)
    volume.commit()


@app.function(gpu="A10G", volumes={REMOTE_DATA: volume}, timeout=60 * 60 * 2, memory=32768)
def _evaluate(name: str, split: str) -> None:
    _run([
        "python", "scripts/evaluate_tgnn.py",
        "--snapshots", f"{REMOTE_DATA}/snapshots/{name}",
        "--checkpoint", f"{REMOTE_DATA}/checkpoints/{name}/best_model.pt",
        "--out", f"{REMOTE_DATA}/checkpoints/{name}/eval_{split}",
        "--split", split,
    ])
    volume.commit()


# ------------------------------------------------------------- CLI entrypoints
@app.local_entrypoint()
def build(input_rel: str, out_name: str, source_tag: str = "mordor",
          label_mode: str = "heuristic", label: int = 1, label_window: int = 300,
          chunk_size: int = 50000, extra: str = "") -> None:
    """Build a labelled graph on Modal from raw data already in the volume."""
    _build.remote(input_rel, out_name, source_tag, label_mode, label,
                  label_window, chunk_size, extra)


@app.local_entrypoint()
def merge(names: str, out_name: str) -> None:
    """Merge processed graphs in the volume: --names a,b --out-name mixed."""
    _merge.remote(names, out_name)


@app.local_entrypoint()
def snapshots(name: str, window_size: int = 60, stride: int = 30,
              max_snapshots: int = 0) -> None:
    _snapshots.remote(name, window_size, stride, max_snapshots)


@app.local_entrypoint()
def train(name: str, epochs: int = 50, hidden: int = 64, lr: float = 0.001,
          extra: str = "") -> None:
    _train.remote(name, epochs, hidden, lr, extra)


@app.local_entrypoint()
def evaluate(name: str, split: str = "test") -> None:
    _evaluate.remote(name, split)


@app.local_entrypoint()
def all(name: str, window_size: int = 60, stride: int = 30, epochs: int = 50) -> None:
    """Snapshots -> train -> evaluate in one shot."""
    _snapshots.remote(name, window_size, stride, 0)
    _train.remote(name, epochs, 64, 0.001, "")
    _evaluate.remote(name, "test")
