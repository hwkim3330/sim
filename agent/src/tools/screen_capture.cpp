#include "simi/tools.hpp"
#include <filesystem>
#include <chrono>
#include <sstream>
#include <iomanip>

#ifdef _WIN32
#include <windows.h>
#include <gdiplus.h>
#pragma comment(lib, "gdiplus.lib")
#endif

namespace fs = std::filesystem;

namespace simi {

// ============================================================================
// ScreenCaptureTool
// ============================================================================

ToolSchema ScreenCaptureTool::get_schema() const {
    return {
        "screenshot",
        "Capture a screenshot of the screen or a specific window.",
        {
            {"output", "string", "Output file path (optional, auto-generated if not provided)", false, std::nullopt},
            {"region", "string", "Region to capture: 'full', 'active', or 'x,y,w,h'", false, "full"}
        }
    };
}

bool ScreenCaptureTool::is_available() const {
#ifdef _WIN32
    return true;
#else
    // Check if scrot or gnome-screenshot is available
    return system("which scrot > /dev/null 2>&1") == 0 ||
           system("which gnome-screenshot > /dev/null 2>&1") == 0;
#endif
}

ToolResult ScreenCaptureTool::execute(const std::map<std::string, std::string>& args) {
    // Generate output path
    std::string output_path;
    if (args.count("output")) {
        output_path = args.at("output");
    } else {
        // Auto-generate filename
        fs::create_directories(output_directory);

        auto now = std::chrono::system_clock::now();
        auto time = std::chrono::system_clock::to_time_t(now);
        std::ostringstream oss;
        oss << output_directory << "/screenshot_"
            << std::put_time(std::localtime(&time), "%Y%m%d_%H%M%S")
            << "." << format;
        output_path = oss.str();
    }

    std::string region = args.count("region") ? args.at("region") : "full";

#ifdef _WIN32
    // Windows GDI+ implementation
    Gdiplus::GdiplusStartupInput gdiplusStartupInput;
    ULONG_PTR gdiplusToken;
    Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);

    // Get screen dimensions
    int x = 0, y = 0;
    int width = GetSystemMetrics(SM_CXSCREEN);
    int height = GetSystemMetrics(SM_CYSCREEN);

    if (region == "active") {
        // Capture active window
        HWND hwnd = GetForegroundWindow();
        if (hwnd) {
            RECT rect;
            GetWindowRect(hwnd, &rect);
            x = rect.left;
            y = rect.top;
            width = rect.right - rect.left;
            height = rect.bottom - rect.top;
        }
    } else if (region != "full") {
        // Parse custom region x,y,w,h
        int cx, cy, cw, ch;
        if (sscanf(region.c_str(), "%d,%d,%d,%d", &cx, &cy, &cw, &ch) == 4) {
            x = cx;
            y = cy;
            width = cw;
            height = ch;
        }
    }

    // Create bitmap
    HDC hdcScreen = GetDC(NULL);
    HDC hdcMem = CreateCompatibleDC(hdcScreen);
    HBITMAP hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
    SelectObject(hdcMem, hBitmap);

    // Copy screen to bitmap
    BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, SRCCOPY);

    // Save using GDI+
    Gdiplus::Bitmap bitmap(hBitmap, NULL);

    // Get encoder CLSID
    CLSID clsid;
    if (format == "png") {
        CLSIDFromString(L"{557CF406-1A04-11D3-9A73-0000F81EF32E}", &clsid);
    } else {
        CLSIDFromString(L"{557CF401-1A04-11D3-9A73-0000F81EF32E}", &clsid);  // JPEG
    }

    // Convert path to wide string
    std::wstring wpath(output_path.begin(), output_path.end());
    Gdiplus::Status status = bitmap.Save(wpath.c_str(), &clsid, NULL);

    // Cleanup
    DeleteObject(hBitmap);
    DeleteDC(hdcMem);
    ReleaseDC(NULL, hdcScreen);
    Gdiplus::GdiplusShutdown(gdiplusToken);

    if (status != Gdiplus::Ok) {
        return {"", false, "", "Failed to save screenshot"};
    }

#else
    // Linux implementation using scrot
    std::string cmd;
    if (region == "active") {
        cmd = "scrot -u '" + output_path + "'";
    } else if (region == "full") {
        cmd = "scrot '" + output_path + "'";
    } else {
        // Custom region
        cmd = "scrot -a " + region + " '" + output_path + "'";
    }

    int result = system(cmd.c_str());
    if (result != 0) {
        return {"", false, "", "Screenshot command failed"};
    }
#endif

    // Verify file was created
    if (!fs::exists(output_path)) {
        return {"", false, "", "Screenshot file was not created"};
    }

    return {"", true, "Screenshot saved: " + output_path, std::nullopt};
}

} // namespace simi
