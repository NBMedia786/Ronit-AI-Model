# Gunicorn Configuration for Production
# This ensures optimal performance and WebSocket support

import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1  # Optimal worker count
worker_class = "sync"  # Use sync for Flask (WebSocket handled by ElevenLabs SDK)
worker_connections = 1000
timeout = 120  # Increased timeout for long WebSocket connections
keepalive = 5

# Logging
accesslog = "-"  # Log to stdout (PM2 will capture)
errorlog = "-"   # Log to stderr (PM2 will capture)
loglevel = os.getenv("LOG_LEVEL", "info").lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "ronit-ai-coach"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (if needed - usually handled by Caddy)
keyfile = None
certfile = None

# Performance
preload_app = True  # Load app before forking workers
max_requests = 1000  # Restart worker after this many requests
max_requests_jitter = 50  # Add randomness to max_requests

# Graceful timeout
graceful_timeout = 30

