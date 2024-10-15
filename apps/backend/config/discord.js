module.exports = {
    username: env("DISCORD_BOT_USERNAME",""),
    avatar_url: env("DISCORD_BOT_AVATAR_URL",""),
    url : env("DISCORD_BOT_URL",""),
    payment_url : env("DISCORD_PAYMENT_WEBHOOK",""),
    bug_url:    env("DISCORD_BUG_WEBHOOK",""),
    client_id: env("DISCORD_BOT_CLIENT_ID",""),
    client_secret: env("DISCORD_BOT_CLIENT_SECRET",""),
    discord_yourgpt_bot_token: env("DISCORD_YOURGPT_BOT_TOKEN"),
    discord_redirect_uri: env("DISCORD_REDIRECT_URI"),
    discord_oauth2_url: env("DISCORD_OAUTH2_URL"),
    discord_auth_id: env("DISCORD_AUTH_CLIENT_ID",""),
    discord_auth_secret: env("DISCORD_AUTH_CLIENT_SECRET","")
}