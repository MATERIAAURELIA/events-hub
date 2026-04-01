#!/usr/bin/env python3
"""Events Hub server — GET/PUT site-config.json + /calendar proxy via gog CLI"""
import http.server
import json
import os
import subprocess
import sys
import time
from datetime import date, timedelta
from urllib.parse import urlparse, parse_qs

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(DIR, 'site-config.json')
GOG_ACCOUNT = 'drumadrumdrum@gmail.com'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/calendar':
            self._handle_calendar(parsed)
        else:
            super().do_GET()

    def _handle_calendar(self, parsed):
        qs = parse_qs(parsed.query)
        today = date.today()
        # Default: first to last day of current month
        from_date = qs.get('from', [today.strftime('%Y-%m-01')])[0]
        if today.month == 12:
            last_day = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            last_day = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
        to_date = qs.get('to', [last_day.strftime('%Y-%m-%d')])[0]

        ts = time.strftime('%H:%M:%S')
        print(f"[{ts}] 📅 Fetching calendar {from_date} → {to_date}")
        try:
            result = subprocess.run(
                ['gog', 'calendar', 'list', 'primary',
                 '--from', from_date, '--to', to_date,
                 '--account', GOG_ACCOUNT, '--json'],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode != 0:
                err = (result.stderr or 'gog returned non-zero').strip()
                print(f"[{ts}] ❌ gog error: {err}")
                self._send_json(500, {'ok': False, 'error': err})
                return

            raw = json.loads(result.stdout)
            events = raw.get('events', [])

            simplified = []
            for ev in events:
                start = ev.get('start', {})
                end   = ev.get('end', {})
                # dateTime for timed events, date for all-day
                dt_start = start.get('dateTime', start.get('date', ''))
                dt_end   = end.get('dateTime',   end.get('date', ''))
                simplified.append({
                    'title':    ev.get('summary', 'Untitled'),
                    'date':     dt_start[:10],
                    'time':     dt_start[11:16] if len(dt_start) > 10 else '',
                    'endTime':  dt_end[11:16]   if len(dt_end)   > 10 else '',
                    'desc':     ev.get('description', ''),
                    'location': ev.get('location', ''),
                    'url':      ev.get('htmlLink', ''),
                })

            print(f"[{ts}] ✅ Calendar: {len(simplified)} events")
            self._send_json(200, {'ok': True, 'events': simplified})

        except subprocess.TimeoutExpired:
            self._send_json(504, {'ok': False, 'error': 'gog CLI timed out (>15s)'})
        except json.JSONDecodeError as e:
            self._send_json(500, {'ok': False, 'error': f'Bad JSON from gog: {e}'})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    def do_PUT(self):
        if self.path == '/site-config.json':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                # Validate JSON before writing
                data = json.loads(body)
                # Atomic write: write to temp file then rename
                tmp_path = CONFIG_PATH + '.tmp'
                with open(tmp_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                os.replace(tmp_path, CONFIG_PATH)
                ts = time.strftime('%H:%M:%S')
                # Also write a timestamped backup every save
                backup_dir = os.path.join(DIR, 'backups')
                os.makedirs(backup_dir, exist_ok=True)
                backup_path = os.path.join(backup_dir, f"site-config-{time.strftime('%Y%m%d-%H%M%S')}.json")
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                # Keep only last 20 backups
                backups = sorted(os.listdir(backup_dir))
                for old in backups[:-20]:
                    try: os.remove(os.path.join(backup_dir, old))
                    except: pass
                print(f"[{ts}] ✅ site-config.json saved ({len(body):,} bytes, {len(data.get('events', []))} events) + backup")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._cors_headers()
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON: {e}")
                self.send_response(400)
                self._cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': f'Invalid JSON: {e}'}).encode())
            except Exception as e:
                print(f"❌ Save error: {e}")
                self.send_response(500)
                self._cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())
        else:
            self.send_response(404)
            self._cors_headers()
            self.end_headers()
            self.wfile.write(b'{"ok":false,"error":"Not found"}')

    def end_headers(self):
        self._cors_headers()
        super().end_headers()

    def log_message(self, fmt, *args):
        # Suppress noisy GET logs for static assets, show PUT/errors
        if args and (args[1] != '200' or 'PUT' in str(args[0])):
            ts = time.strftime('%H:%M:%S')
            print(f"[{ts}] {fmt % args}")

def main():
    server = http.server.HTTPServer(('localhost', PORT), Handler)
    print(f"🚀 Events Hub server on http://localhost:{PORT}")
    print(f"   Serving: {DIR}")
    print(f"   PUT /site-config.json  → atomic save")
    print(f"   GET /calendar          → Google Calendar via gog ({GOG_ACCOUNT})")
    print(f"   Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        sys.exit(0)

if __name__ == '__main__':
    main()
