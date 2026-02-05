@echo off
echo Applying database migrations...
cd packages\worker
wrangler d1 migrations apply cfdrive-db --local --persist-to ..\..\..wrangler\state
pause
