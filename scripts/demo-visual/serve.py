"""Serve published files with opt-in QA injection; never part of the site build."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=41387, choices=[41387, 41388])
parser.add_argument("--fail-module", action="store_true")
parser.add_argument("--fail-style", action="store_true")
args = parser.parse_args()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *arguments, **kwargs):
        super().__init__(*arguments, directory=str(ROOT / "docs"), **kwargs)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/__demo-qa.js":
            self.send_bytes((ROOT / "scripts/demo-visual/qa.js").read_bytes(), "text/javascript")
            return
        if (args.fail_module and parsed.path == "/assets/demo/main.js") or (args.fail_style and parsed.path == "/assets/demo/main.css"):
            self.send_error(503, "Intentional local QA failure")
            return
        path = Path(self.translate_path(self.path)).resolve()
        if path.is_dir():
            path /= "index.html"
        if (ROOT / "docs").resolve() in path.parents and path.suffix == ".html" and path.is_file() and "qa" in parse_qs(parsed.query):
            html = path.read_text(encoding="utf-8")
            # Register error capture before the production entry executes.
            html = html.replace("<head>", '<head><script src="/__demo-qa.js"></script>', 1)
            self.send_bytes(html.encode("utf-8"), "text/html; charset=utf-8")
            return
        super().do_GET()

    def send_bytes(self, content, kind):
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)


print(f"Isolated demo preview: http://127.0.0.1:{args.port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
