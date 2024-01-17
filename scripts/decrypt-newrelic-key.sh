# Place a decrypted NR license key into the shell
# Depends on https://github.com/NYPL-discovery/kms-util

# Encrypted license key:
NEW_RELIC_LICENSE_KEY_ENC=AQECAHh7ea2tyZ6phZgT4B9BDKwguhlFtRC6hgt+7HbmeFsrsgAAAIcwgYQGCSqGSIb3DQEHBqB3MHUCAQAwcAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzeWd/UhQA5d2UmqSoCARCAQ46e5HPvuORTrgdPyIKwkntvMJz0++1I/jo3a0QJT60jFzvW+8y1zuSkxXM7uQr76JwKM6qbtaVLmJjPNMqTYxy+64g=

export SET NEW_RELIC_LICENSE_KEY=`kms-util decrypt $NEW_RELIC_LICENSE_KEY_ENC`
