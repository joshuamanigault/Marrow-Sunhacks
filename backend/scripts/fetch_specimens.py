"""Fetch and verify catalog sources, safely extract STLs, and optionally prepare.

From backend/: python -X utf8 scripts/fetch_specimens.py --all --prepare
For manual downloads: add --downloads-dir <folder> (no network needed for those).
Dryad API authentication, when required, uses DRYAD_API_TOKEN from the environment.
Original downloads and extracted meshes remain in gitignored data/.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from marrow.specimens.preparation import (  # noqa: E402
    REPO_ROOT,
    SourceFile,
    catalog_ids,
    load_config,
    is_source_mesh,
)


def verify_source(path: Path, source: SourceFile) -> bool:
    if not path.is_file() or path.stat().st_size != source.size:
        return False
    algorithm = "sha256" if source.digestType == "sha-256" else "md5"
    digest = hashlib.new(algorithm, usedforsecurity=False)
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest() == source.digest


def extract_meshes(archive: Path, raw_dir: Path) -> None:
    """Only extract mesh members; reject paths that escape the specimen folder."""
    root = raw_dir.resolve()
    with zipfile.ZipFile(archive) as bundle:
        members = [m for m in bundle.infolist() if is_source_mesh(Path(m.filename))]
        if not members:
            raise ValueError(f"No source meshes in {archive.name}")
        destinations: set[Path] = set()
        for member in members:
            destination = (root / member.filename).resolve()
            if (
                "\\" in member.filename
                or not destination.is_relative_to(root)
                or destination in destinations
            ):
                raise ValueError(
                    f"Unsafe or duplicate archive member: {member.filename}"
                )
            destinations.add(destination)
        for member in members:
            destination = root / member.filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(member) as src, destination.open("wb") as dst:
                shutil.copyfileobj(src, dst)


def fetch_source(source: SourceFile, target: Path, downloads_dir: Path | None) -> None:
    if verify_source(target, source):
        print(f"Verified existing {source.filename}", flush=True)
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    local = downloads_dir / source.filename if downloads_dir else None
    if local and local.is_file():
        if not verify_source(local, source):
            raise ValueError(f"Published checksum/size mismatch: {local}")
        shutil.copyfile(local, target)
        return
    token = os.environ.get("DRYAD_API_TOKEN")
    url = (
        f"https://datadryad.org/api/v2/files/{source.fileId}/download"
        if token
        else f"https://datadryad.org/downloads/file_stream/{source.fileId}"
    )
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    request = urllib.request.Request(url, headers=headers)
    partial = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            with partial.open("wb") as handle:
                shutil.copyfileobj(response, handle)
        if not verify_source(partial, source):
            raise ValueError(f"Published checksum/size mismatch: {source.filename}")
        partial.replace(target)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"Dryad returned HTTP {exc.code} for {source.filename}. "
            "Download it through Dryad and pass --downloads-dir, or supply an "
            "authorized DRYAD_API_TOKEN. No prepared specimen was published."
        ) from None
    finally:
        partial.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--all", action="store_true")
    selection.add_argument("--specimen", choices=catalog_ids())
    parser.add_argument("--downloads-dir", type=Path)
    parser.add_argument("--prepare", action="store_true")
    args = parser.parse_args()
    failures: list[str] = []
    for specimen_id in catalog_ids() if args.all else [args.specimen]:
        config = load_config(specimen_id)
        try:
            for source in config.sourceFiles:
                print(f"{specimen_id}: fetching {source.filename}", flush=True)
                target = REPO_ROOT / "data" / "downloads" / source.filename
                fetch_source(source, target, args.downloads_dir)
                if target.suffix.lower() == ".zip":
                    extract_meshes(target, config.raw_dir)
                else:
                    config.raw_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(target, config.raw_dir / source.filename)
            catalog = config.structure_catalog(config.raw_dir)
            missing = [
                name for name in catalog if not (config.raw_dir / name).is_file()
            ]
            if missing:
                raise ValueError(f"Source meshes missing: {', '.join(missing)}")
            if args.prepare:
                subprocess.run(
                    [
                        sys.executable,
                        "-X",
                        "utf8",
                        str(Path(__file__).with_name("prepare_specimen.py")),
                        "--specimen",
                        specimen_id,
                        "all",
                    ],
                    check=True,
                )
        except (
            OSError,
            ValueError,
            RuntimeError,
            subprocess.CalledProcessError,
        ) as exc:
            failures.append(specimen_id)
            print(f"{specimen_id}: {exc}", file=sys.stderr, flush=True)
    if failures:
        raise SystemExit(f"Incomplete specimens: {', '.join(failures)}")


if __name__ == "__main__":
    main()
