# Worker for Zelador Mensa Brasil

## Pre-requisites (Linux/Ubuntu 24.04)

1. Change sample.env file to .env and add the correct required environment variables.

2. Install nvm and node

   ```bash
   # Download and install nvm:
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash

   # in lieu of restarting the shell
   \. "$HOME/.nvm/nvm.sh"

   # Download and install Node.js
   nvm install 22

   # Verify the Node.js version
   node -v # Should print "v22.14.0".
   nvm current # Should print "v22.14.0".

   # Verify npm version
   npm -v # Should print "10.9.2".
   ```

3. Install dependencies

   ```bash
   sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64
   ```

4. Install package.json dependencies

   ```bash
   npm install
   ```

## Running

The following commands are available to run the worker:

- **Start**: Starts the worker with default settings.

   ```bash
   npm start
   # Equivalent to:
   node --max-old-space-size=1024 src/main.js
   ```

- **Add**: Process add queue.

   ```bash
   npm run add
   # Equivalent to:
   node --max-old-space-size=1024 src/main.js --add
   ```

- **Remove**: Process remove queue.

   ```bash
   npm run remove
   # Equivalent to:
   node --max-old-space-size=1024 src/main.js --remove
   ```
