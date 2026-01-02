@echo off
REM Simi Agent Build Script for Windows

echo ======================================
echo   Simi Agent - Build Script
echo ======================================
echo.

REM Check for CMake
where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake not found. Please install CMake.
    echo Download: https://cmake.org/download/
    exit /b 1
)

REM Check for OpenVINO
if not defined OPENVINO_FOLDER (
    echo WARNING: OPENVINO_FOLDER not set.
    echo Trying to find OpenVINO...

    if exist "C:\Program Files (x86)\Intel\openvino_2025" (
        set OPENVINO_FOLDER=C:\Program Files (x86)\Intel\openvino_2025
    ) else if exist "%USERPROFILE%\intel\openvino_2025" (
        set OPENVINO_FOLDER=%USERPROFILE%\intel\openvino_2025
    ) else (
        echo ERROR: OpenVINO not found.
        echo Please install OpenVINO and set OPENVINO_FOLDER environment variable.
        exit /b 1
    )
    echo Found OpenVINO at: %OPENVINO_FOLDER%
)

REM Setup OpenVINO environment
if exist "%OPENVINO_FOLDER%\setupvars.bat" (
    call "%OPENVINO_FOLDER%\setupvars.bat"
)

REM Create build directory
if not exist build mkdir build
cd build

REM Configure
echo.
echo Configuring...
cmake -DCMAKE_BUILD_TYPE=Release ..
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake configuration failed.
    cd ..
    exit /b 1
)

REM Build
echo.
echo Building...
cmake --build . --config Release
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed.
    cd ..
    exit /b 1
)

cd ..

echo.
echo ======================================
echo   Build Complete!
echo ======================================
echo.
echo Run with: build\Release\simi.exe -m models\qwen2.5-vl-3b-instruct
echo.
