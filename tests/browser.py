#!/usr/bin/env python3
"""Run the synthetic playback regression in an isolated Chrome profile."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import html
import re
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
chrome = next((shutil.which(name) for name in ("google-chrome", "chromium", "chromium-browser")
               if shutil.which(name)), None)
if not chrome:
    candidate = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if candidate.is_file():
        chrome = str(candidate)
if not chrome:
    sys.exit("Install Chrome or Chromium to run the browser regression.")


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


with ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(root))) as server:
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with TemporaryDirectory(prefix="movies-browser-test-") as profile:
            run = subprocess.run([
                chrome, "--headless", "--no-first-run", "--no-default-browser-check",
                "--user-data-dir=" + profile, "--window-size=1400,1000",
                "--virtual-time-budget=5000", "--dump-dom",
                "http://127.0.0.1:%d/tests/browser.html" % server.server_port,
            ], capture_output=True, text=True, timeout=30)
        result = re.search(r'<output id="result" data-status="([^"]+)">([^<]*)</output>', run.stdout)
        print(html.unescape(result.group(2)) if result else "FAIL: Chrome returned no test result")
        if run.returncode or not result or result.group(1) != "pass":
            sys.exit(1)
    finally:
        server.shutdown()
