#!/bin/bash
# Simi Agent Build Script for Linux/macOS

echo "======================================"
echo "  Simi Agent - Build Script"
echo "======================================"
echo

# Check for CMake
if ! command -v cmake &> /dev/null; then
    echo "ERROR: CMake not found. Please install CMake."
    exit 1
fi

# Check for OpenVINO
if [ -z "$OPENVINO_FOLDER" ]; then
    echo "WARNING: OPENVINO_FOLDER not set."
    echo "Trying to find OpenVINO..."

    if [ -d "/opt/intel/openvino_2025" ]; then
        export OPENVINO_FOLDER="/opt/intel/openvino_2025"
    elif [ -d "$HOME/intel/openvino_2025" ]; then
        export OPENVINO_FOLDER="$HOME/intel/openvino_2025"
    else
        echo "WARNING: OpenVINO not found. Build may fail."
        echo "Install: pip install openvino openvino-genai"
    fi

    if [ -n "$OPENVINO_FOLDER" ]; then
        echo "Found OpenVINO at: $OPENVINO_FOLDER"
    fi
fi

# Setup OpenVINO environment
if [ -f "$OPENVINO_FOLDER/setupvars.sh" ]; then
    source "$OPENVINO_FOLDER/setupvars.sh"
fi

# Create build directory
mkdir -p build
cd build

# Configure
echo
echo "Configuring..."
cmake -DCMAKE_BUILD_TYPE=Release ..
if [ $? -ne 0 ]; then
    echo "ERROR: CMake configuration failed."
    cd ..
    exit 1
fi

# Build
echo
echo "Building..."
cmake --build . --config Release -j$(nproc)
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed."
    cd ..
    exit 1
fi

cd ..

echo
echo "======================================"
echo "  Build Complete!"
echo "======================================"
echo
echo "Run with: ./build/simi -m models/qwen2.5-vl-3b-instruct"
echo
