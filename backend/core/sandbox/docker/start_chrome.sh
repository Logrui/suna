#!/bin/bash
# Find Chrome binary installed by Playwright
CHROME_BIN=$(find /ms-playwright -name chrome | head -n 1)

if [ -z "$CHROME_BIN" ]; then
    echo "Chrome binary not found!"
    exit 1
fi

echo "Found Chrome at $CHROME_BIN"

# Set display
export DISPLAY=:99

# Start Chrome
# --no-sandbox: Required for Docker
# --test-type: Removes "Chrome is being controlled by automated test software" banner
# --ignore-certificate-errors: Useful for dev
# --start-maximized: Full screen
# --user-data-dir: separate profile
# --remote-debugging-port: Enable CDP for potential external control
# --disable-gpu: Often needed in Docker
exec $CHROME_BIN \
    --no-sandbox \
    --disable-setuid-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --test-type \
    --ignore-certificate-errors \
    --start-maximized \
    --user-data-dir=/tmp/chrome-data-standby \
    --remote-debugging-port=9222 \
    https://google.com
