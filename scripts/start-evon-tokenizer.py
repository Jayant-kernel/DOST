"""Official pinned tokenizer, loopback only. Loads no model weights or remote code."""
import hashlib
import json
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tokenizers import Tokenizer

URL='https://huggingface.co/gnani/gnani-evon-v3.3-30B-A3B/resolve/fb9ddb6b58f2d235684388a9260671fca5ebccaf/tokenizer.json'
SHA='aad950fc394568e17f04900e65553dceacecbd2c1725977bf0b5f98ed7e14d2d'
path=Path('.saathi-local/evon-tokenizer.json')
if not path.exists():
    with urllib.request.urlopen(URL, timeout=60) as response:
        data=response.read()
    if hashlib.sha256(data).hexdigest()!=SHA:
        raise ValueError('Tokenizer checksum mismatch')
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(data)
raw=path.read_bytes()
if hashlib.sha256(raw).hexdigest()!=SHA:
    raise ValueError('Tokenizer checksum mismatch')
tokenizer=Tokenizer.from_str(raw.decode('utf-8'))

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log prompt text.
    def do_POST(self):
        self.connection.settimeout(10)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if self.path!='/tokenize' or self.headers.get('Origin') or self.headers.get('Host') not in ('127.0.0.1:8081','localhost:8081') or not 0<size<=64000:
                raise ValueError()
            payload=json.loads(self.rfile.read(size))
            if not isinstance(payload.get('content'),str) or len(payload['content'])>20000:
                raise ValueError()
            ids=tokenizer.encode(payload['content'],add_special_tokens=False).ids
            # Report overflow so the caller can trim old exchanges and retry.
            # Never send an oversized prompt's IDs to the model.
            result=json.dumps({'tokens':ids if len(ids)<=1900 else [],'token_count':len(ids)}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Length',str(len(result)))
            self.end_headers()
            self.wfile.write(result)
        except Exception:
            self.send_error(400,'Invalid or oversized tokenizer request')

print('Official Evon tokenizer listening on 127.0.0.1:8081; no model weights loaded',flush=True)
ThreadingHTTPServer(('127.0.0.1',8081),Handler).serve_forever()
