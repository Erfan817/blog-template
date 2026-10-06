#!/usr/bin/env python3
"""开发预览服务器：python serve.py [端口]

与 python -m http.server 的区别：响应带 Cache-Control: no-cache，
改完 JS/CSS 刷新即可生效，不用强刷清缓存。
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"MyBlog dev server → http://127.0.0.1:{port}/  (Ctrl+C 停止)")
    server.serve_forever()
