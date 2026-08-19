#!/bin/bash
set -e

export PATH="/home/rohith/.nvm/versions/node/v20.20.1/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/rohith/college-gym

echo "=== Pulling latest changes from main ==="
git pull origin main

echo "=== Installing workspace dependencies ==="
npm ci || npm install

echo "=== Running PostgreSQL schema migrations ==="
cd backend
npm run db:migrate
npm run db:seed
cd ..

echo "=== Building all workspace packages ==="
npm run build --workspaces

echo "=== Reloading PM2 processes ==="
pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs
pm2 save

echo "=== Testing and reloading Nginx ==="
echo "pRINCE@18" | sudo -S /usr/sbin/nginx -t
echo "pRINCE@18" | sudo -S /bin/systemctl reload nginx

echo "=== College Gym Deployment Complete! ==="
