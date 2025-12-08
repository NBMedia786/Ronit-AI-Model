import multiprocessing
import os

# Gunicorn Configuration for Ronit AI Coach

# Bind to localhost on port 5000 (Caddy will proxy to this)
bind = "127.0.0.1:5000"

# Worker Configuration
# For CPU-bound tasks, (2 * CPUs) + 1 is recommended.
# For I/O-bound tasks (like this app with external API calls), more workers are better.
workers = 2  # Start conservative for VPS
threads = 4  # Use threads for concurrency within workers
worker_class = "gthread"  # Threaded worker for I/O bound tasks

# Timeout Configuration
# ElevenLabs WebSocket connections can be long-lived
timeout = 120
keepalive = 5

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"

# Process Naming
proc_name = "ronit-ai-coach"

# Reload in development (optional, disabled for production stability)
reload = False

# Environment Variables (can be overridden by system env)
raw_env = [
    "FLASK_ENV=production",
    "PYTHONUNBUFFERED=1"
]
