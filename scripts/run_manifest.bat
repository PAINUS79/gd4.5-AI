@echo off
setlocal enabledelayedexpansion

REM Resolve repo root (this bat is in scripts\)
set SCRIPT_DIR=%~dp0
for %%I in ("%SCRIPT_DIR%..") do set REPO_ROOT=%%~fI
cd /d "%REPO_ROOT%"

if "%~1"=="" (
  echo Usage: run_manifest.bat ^<npm_script^> [extra args...]
  exit /b 2
)

set NPM_SCRIPT=%~1
shift

set EXTRA_ARGS=
:collect_args
if "%~1"=="" goto args_done
set EXTRA_ARGS=!EXTRA_ARGS! "%~1"
shift
goto collect_args
:args_done

REM Try npm from PATH
where npm >nul 2>nul
if %errorlevel%==0 (
  npm run %NPM_SCRIPT% -- %EXTRA_ARGS%
  exit /b %errorlevel%
)

REM Try corepack fallback
where corepack >nul 2>nul
if %errorlevel%==0 (
  corepack npm run %NPM_SCRIPT% -- %EXTRA_ARGS%
  exit /b %errorlevel%
)

echo ERROR: npm not found in PATH and corepack unavailable.
exit /b 127
