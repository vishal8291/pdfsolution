/**
 * PM2 Ecosystem Config — PDF Solution
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save          (persist across reboots)
 *   pm2 startup       (add to system startup)
 *
 * Zero-downtime reload:
 *   pm2 reload pdf-server   (rolling restart — no downtime)
 *
 * Monitoring:
 *   pm2 monit         (live dashboard)
 *   pm2 logs          (tail all logs)
 *   pm2 status        (process health)
 */

module.exports = {
  apps: [
    {
      // ── API Server ────────────────────────────────────────────
      name: "pdf-server",
      script: "./server/index.ts",
      interpreter: "node",
      interpreter_args: "--import tsx/esm",

      // Cluster mode = one worker per CPU core (max parallelism)
      instances: "max",
      exec_mode: "cluster",

      // Auto-restart settings
      autorestart: true,
      max_restarts: 10,         // give up after 10 crashes in restart_delay window
      restart_delay: 5_000,    // wait 5 s before each restart attempt
      min_uptime: "30s",        // if process dies in <30 s, PM2 marks it as erroring

      // Memory guard — restart if RAM usage exceeds 512 MB
      max_memory_restart: "512M",

      // Graceful shutdown — send SIGINT and wait up to 10 s for server.close()
      kill_timeout: 10_000,
      shutdown_with_message: false,
      wait_ready: false,

      // Watch & ignore (only for dev — disable in production)
      watch: false,

      // Log files (PM2 manages rotation)
      out_file:   "./logs/server-out.log",
      error_file: "./logs/server-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
