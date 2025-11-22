import http.server
import socketserver
import os

PORT = 8000

web_dir = os.path.join(os.path.dirname(__file__), '.')
os.chdir(web_dir)

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving AETHER at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    httpd.serve_forever()
