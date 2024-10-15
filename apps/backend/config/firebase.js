module.exports = {
    "type": "service_account",
    "project_id": env("FIREBASE_PROJECT_ID", ""),
    "private_key_id": env("FIREBASE_PRIVATE_KEY_ID", ""),
    "private_key": env("FIREBASE_PRIVATE_KEY", ""),
    "client_email": env("FIREBASE_CLIENT_EMAIL", ""),
    "client_id": env("FIREBASE_CLIENT_ID", ""),
    "auth_uri": env("FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
    "token_uri": env("FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
    "auth_provider_x509_cert_url": env("FIREBASE_AUTH_PROVIDER_X509_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"),
    "client_x509_cert_url": env("FIREBASE_CLIENT_X509_CERT_URL", "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-8zv3v%40test-8b7b4.iam.gserviceaccount.com"),
    "universe_domain": "googleapis.com"
}