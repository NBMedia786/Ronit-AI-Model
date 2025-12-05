// PM2 Ecosystem Configuration for Ronit AI Coach
// This ensures proper process management and auto-restart

module.exports = {
  apps: [{
    name: 'ronit-ai-coach',
    script: 'gunicorn',
    args: '--config gunicorn_config.py app:app',
    interpreter: 'python3',
    instances: 2, // Run 2 instances for better performance
    exec_mode: 'cluster',
    
    // Auto-restart configuration
    autorestart: true,
    watch: false, // Set to true for development, false for production
    max_memory_restart: '500M', // Restart if memory exceeds 500MB
    
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

