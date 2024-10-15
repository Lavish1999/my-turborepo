module.exports = {
    host: env("REDIS_HOST", ""),
    port: env("REDIS_PORT", 6379),
    password: env("REDIS_PASSWORD", "")
};