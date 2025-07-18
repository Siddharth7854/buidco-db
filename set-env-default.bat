@echo off
echo Setting up environment variables for SQL Server (Default Port)...

set DB_SERVER=localhost
set DB_PORT=1433
set DB_NAME=BUIDCO
set DB_USER=sa
set DB_PASSWORD=Sid91221
set PORT=5000
set NODE_ENV=development

echo Environment variables set:
echo DB_SERVER=%DB_SERVER%
echo DB_PORT=%DB_PORT%
echo DB_NAME=%DB_NAME%
echo DB_USER=%DB_USER%
echo PORT=%PORT%
echo NODE_ENV=%NODE_ENV%

echo.
echo Starting the server...
node index.cjs 