cmake_minimum_required(VERSION 3.16)
project(simi-agent VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Find OpenVINO
find_package(OpenVINO REQUIRED COMPONENTS Runtime GenAI)

# Platform-specific settings
if(WIN32)
    add_definitions(-DWIN32_LEAN_AND_MEAN -DNOMINMAX)
    set(PLATFORM_LIBS ws2_32 winhttp)
elseif(UNIX)
    set(PLATFORM_LIBS pthread dl)
endif()

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/include
    ${OpenVINO_INCLUDE_DIRS}
)

# Source files
set(CORE_SOURCES
    src/core/vlm_engine.cpp
    src/core/llm_engine.cpp
    src/core/agent.cpp
    src/core/context.cpp
)

set(TOOL_SOURCES
    src/tools/file_ops.cpp
    src/tools/shell_exec.cpp
    src/tools/screen_capture.cpp
    src/tools/web_fetch.cpp
    src/tools/tool_registry.cpp
)

set(UTIL_SOURCES
    src/utils/json.cpp
    src/utils/string_utils.cpp
    src/utils/image_utils.cpp
)

# Main library
add_library(simi-core STATIC
    ${CORE_SOURCES}
    ${TOOL_SOURCES}
    ${UTIL_SOURCES}
)

target_link_libraries(simi-core
    openvino::runtime
    openvino::genai
    ${PLATFORM_LIBS}
)

# CLI executable
add_executable(simi
    src/main.cpp
)

target_link_libraries(simi
    simi-core
)

# Install
install(TARGETS simi DESTINATION bin)
install(DIRECTORY include/ DESTINATION include)

# Model download helper script
configure_file(
    ${CMAKE_SOURCE_DIR}/scripts/download_model.cmake.in
    ${CMAKE_BINARY_DIR}/download_model.cmake
    @ONLY
)

# Custom target for model download
add_custom_target(download-model
    COMMAND ${CMAKE_COMMAND} -P ${CMAKE_BINARY_DIR}/download_model.cmake
    COMMENT "Downloading Qwen2.5-VL-3B model..."
)

message(STATUS "Simi Agent v${PROJECT_VERSION}")
message(STATUS "OpenVINO: ${OpenVINO_VERSION}")
