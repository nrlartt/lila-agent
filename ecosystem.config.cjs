/** PM2 config: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "lila-agent-bot",
      script: "dist/index.js",
      args: "bot",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
