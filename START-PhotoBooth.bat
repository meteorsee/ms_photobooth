@echo off
setlocal
title to you. - PhotoBooth
cd /d "%~dp0"

py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if not errorlevel 1 goto use_py

python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if not errorlevel 1 goto use_python

echo PhotoBooth needs Python 3.9 or newer.
echo.
echo Install a current Python 3 release from:
echo https://www.python.org/downloads/windows/
echo.
echo Then close this window and double-click START-PhotoBooth.bat again.
pause
exit /b 1

:use_py
py -3 "%~dp0server.py" %*
goto finished

:use_python
python "%~dp0server.py" %*

:finished
if errorlevel 1 (
    echo.
    echo PhotoBooth could not start. Check the message above.
    pause
)
endlocal
