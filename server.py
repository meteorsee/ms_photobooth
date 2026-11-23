"""Run the bundled photo booth locally with Python's standard library."""

import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser

WEB_ROOT = Path(__file__).resolve().parent / "web"


class PhotoBoothHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".otf": "font/otf",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "Not found")
        return None

    def log_message(self, format, *args):
        # Keep the launcher readable; errors still appear.
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    if not (WEB_ROOT / "index.html").is_file():
        print("Missing web/index.html. Extract the complete ZIP before starting.")
        return 1

    handler = partial(PhotoBoothHandler, directory=str(WEB_ROOT))
    server = None
    for port in range(args.port, min(args.port + 10, 65536)):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
            break
        except OSError as error:
            if error.errno != errno.EADDRINUSE and getattr(error, "winerror", None) != 10048:
                print("Could not start PhotoBooth: {}".format(error))
                return 1
    if server is None:
        print("Ports {}-{} are busy. Close an old launcher or run:".format(
            args.port, min(args.port + 9, 65535)))
        print("  py -3 server.py --port 8090")
        return 1

    url = "http://localhost:{}/".format(server.server_port)
    print("\nMoment Studio - Your local PhotoBooth")
    print("\nOpen: " + url)
    print("Allow camera access when your browser asks.")
    print("Keep this window open while using the booth.")
    print("Press Ctrl+C or close this window to stop.\n", flush=True)
    if not args.no_browser:
        browser_timer = threading.Timer(0.4, webbrowser.open, args=(url,))
        browser_timer.daemon = True
        browser_timer.start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\nPhotoBooth stopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
