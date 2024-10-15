module.exports = {
  "type": "service_account",
  "project_id": env("GOOGLE_TRANSLATE_PROJECT_ID", ""),
  "private_key_id": env("GOOGLE_TRANSLATE_PRIVATE_KEY_ID", ""),
  "private_key": env("GOOGLE_TRANSLATE_PRIVATE_KEY", ""),
  "client_email": env("GOOGLE_TRANSLATE_CLIENT_EMAIL", ""),
  "client_id": env("GOOGLE_TRANSLATE_CLIENT_ID", ""),
  "auth_uri": env("GOOGLE_TRANSLATE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
  "token_uri": env("GOOGLE_TRANSLATE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
  "auth_provider_x509_cert_url": env("GOOGLE_TRANSLATE_AUTH_PROVIDER_X509_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"),
  "client_x509_cert_url": env("GOOGLE_TRANSLATE_CLIENT_X509_CERT_URL", "https://www.googleapis.com/robot/v1/metadata/x509/GOOGLE_TRANSLATE-adminsdk-8zv3v%40test-8b7b4.iam.gserviceaccount.com"),
  "universe_domain": "googleapis.com"
  }