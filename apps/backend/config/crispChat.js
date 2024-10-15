module.exports = {
    CRISP_API_PUBLIC_KEY: env("CRISP_API_PUBLIC_KEY", ""),
    CRISP_API_SECRET_KEY: env("CRISP_API_SECRET_KEY", ""),
    CRISP_API_ENDPOINT: env("CRISP_API_ENDPOINT",""),
    END_CRISP_SESSION_ENDPOINT: env("END_CRISP_SESSION_ENDPOINT", ""),
   
    crispAPIIdentifier: env("CRISP_API_IDENTIFIER", ""),
    crispAPIKey: env("CRISP_API_KEY", "")
};