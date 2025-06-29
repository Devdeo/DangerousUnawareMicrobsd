const { env } = process;

const nextConfig = {
  allowedDevOrigins: [env.REPLIT_DOMAINS?.split(",")[0]],
};

module.exports = nextConfig;
