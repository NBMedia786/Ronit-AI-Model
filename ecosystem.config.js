// PM2 Ecosystem Configuration for Ronit AI Coach
// This ensures proper process management and auto-restart

module.exports = {
  apps: [{
    name: 'ronit-ai-coach',
    script: 'gunicorn',
    args: '-c gunicorn_config.py app:app',
    interpreter: 'python3',
    instances: 1, // Use 1 instance controlled by Gunicorn workers
    exec_mode: 'fork', // Gunicorn manages its own workers

    // Auto-restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',

    // Environment variables
    env: {
      FLASK_ENV: 'production',
      ENVIRONMENT: 'production',
      PORT: 5000
    },

    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Advanced settings
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,

    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};

