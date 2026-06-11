@echo off
echo.
echo ============================================
echo  IIT Pre-Enrollment — Database Reset Script
echo ============================================
echo.
echo [1/3] Resetting database schema...
npx prisma db push --force-reset
if %errorlevel% neq 0 (
    echo ERROR: prisma db push failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Regenerating Prisma client...
npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Seeding database...
npx prisma db seed
if %errorlevel% neq 0 (
    echo ERROR: prisma db seed failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Done! Database reset and seeded.
echo  Restart the dev server: npm run dev
echo ============================================
echo.
pause
