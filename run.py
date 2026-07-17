from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import venv
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV_DIR = ROOT / ".venv"
PYTHON = VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPM = "npm.cmd" if os.name == "nt" else "npm"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_checked(command: list[str], cwd: Path) -> None:
    print(f"  → {' '.join(command)}")
    subprocess.run(command, cwd=cwd, check=True)


def ensure_dependencies(skip: bool) -> None:
    if skip:
        return
    if not PYTHON.exists():
        print("Creating Bullyx Python environment…")
        venv.create(VENV_DIR, with_pip=True)
    requirements = BACKEND / "requirements-dev.txt"
    stamp = VENV_DIR / ".requirements-sha256"
    expected = digest(requirements) + digest(BACKEND / "requirements.txt")
    if not stamp.exists() or stamp.read_text(encoding="utf-8") != expected:
        print("Installing backend dependencies…")
        run_checked(
            [str(PYTHON), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(requirements)],
            BACKEND,
        )
        stamp.write_text(expected, encoding="utf-8")
    if not (FRONTEND / "node_modules").exists():
        if not shutil.which(NPM):
            raise RuntimeError("Node.js/npm is required. Install Node 20+ and run again.")
        print("Installing frontend dependencies…")
        run_checked([NPM, "install"], FRONTEND)


def wait_for(url: str, process: subprocess.Popen, timeout: float = 90) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"A Bullyx process exited early with code {process.returncode}.")
        try:
            with urllib.request.urlopen(url, timeout=1):
                return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.35)
    raise RuntimeError(f"Timed out waiting for {url}")


def stop(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the complete Bullyx local demo.")
    parser.add_argument("--skip-install", action="store_true", help="Skip dependency checks.")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser.")
    parser.add_argument("--reset", action="store_true", help="Delete only the generated demo database before starting.")
    parser.add_argument("--smoke-test", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.reset:
        data_dir = (ROOT / "data").resolve()
        for name in ("bullyx.db", "bullyx.db-shm", "bullyx.db-wal", "cortex.db", "cortex.db-shm", "cortex.db-wal"):
            target = (data_dir / name).resolve()
            if target.parent != data_dir:
                raise RuntimeError("Refusing to reset a path outside the Bullyx data directory.")
            target.unlink(missing_ok=True)
        print("Reset the generated Bullyx demo database.")

    ensure_dependencies(args.skip_install)
    backend_port = int(os.getenv("BULLYX_BACKEND_PORT") or os.getenv("CORTEX_BACKEND_PORT", "8000"))
    frontend_port = int(os.getenv("BULLYX_FRONTEND_PORT") or os.getenv("CORTEX_FRONTEND_PORT", "5173"))
    env = os.environ.copy()
    env["BULLYX_BACKEND_PORT"] = str(backend_port)
    env["BULLYX_FRONTEND_PORT"] = str(frontend_port)

    print("Starting Bullyx…")
    backend = subprocess.Popen(
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(backend_port)],
        cwd=BACKEND,
        env=env,
    )
    frontend = subprocess.Popen([NPM, "run", "dev"], cwd=FRONTEND, env=env)
    try:
        wait_for(f"http://127.0.0.1:{backend_port}/health", backend)
        wait_for(f"http://127.0.0.1:{frontend_port}", frontend)
        url = f"http://127.0.0.1:{frontend_port}"
        print("\nBullyx is ready.")
        print(f"  App:      {url}")
        print(f"  API docs: http://127.0.0.1:{backend_port}/docs")
        print("  Stop:     Ctrl+C\n")
        if args.smoke_test:
            print("Launcher smoke test passed; stopping child processes.")
            return 0
        if not args.no_open:
            webbrowser.open(url)
        while backend.poll() is None and frontend.poll() is None:
            time.sleep(0.5)
        return backend.returncode or frontend.returncode or 1
    except KeyboardInterrupt:
        print("\nStopping Bullyx…")
        return 0
    finally:
        stop(frontend)
        stop(backend)


if __name__ == "__main__":
    raise SystemExit(main())
