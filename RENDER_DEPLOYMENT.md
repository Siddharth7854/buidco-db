# Render Deployment Configuration

## Build Command

```bash
npm install --production
```

## Start Command

```bash
node index.cjs
```

## Environment Variables Required:

- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: production

## Node Version

- Node.js 18.20.4 (as specified in .nvmrc)

## Common Issues & Solutions:

### Error: Cannot find module './router'

This is usually caused by:

1. Corrupted express installation
2. Wrong Node.js version
3. Missing dependencies

**Solution**:

1. Delete node_modules and package-lock.json
2. Run `npm install --production`
3. Ensure Node.js version matches .nvmrc

### Database Connection Issues:

Make sure DATABASE_URL is properly set in Render environment variables.

### Port Issues:

The app automatically uses `process.env.PORT` which Render provides.
