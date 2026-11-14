import http.server,functools
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class Server(http.server.ThreadingHTTPServer):request_queue_size=128;daemon_threads=True
Server(('127.0.0.1',8803),functools.partial(Quiet,directory='dist')).serve_forever()
