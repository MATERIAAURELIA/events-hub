#!/usr/bin/env python3
"""Simple HTTP server that supports PUT for saving site-config.json"""
import http.server
import json
import os

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    
    def do_PUT(self):
        if self.path == '/site-config.json':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                # Validate JSON
                data = json.loads(body)
                with open(os.path.join(DIR, 'site-config.json'), 'w') as f:
                    json.dump(data, f, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
                print(f"✅ site-config.json saved ({len(body)} bytes)")
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

print(f"🚀 Events Hub server running at http://localhost:{PORT}")
print(f"   Serving from: {DIR}")
print(f"   PUT /site-config.json enabled")
http.server.HTTPServer(('', PORT), Handler).serve_forever()
