// Image utilities for loading and preprocessing
#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <stdexcept>

namespace fs = std::filesystem;

namespace simi {
namespace image {

/**
 * Read raw image bytes from file
 */
std::vector<uint8_t> read_file(const std::string& path) {
    if (!fs::exists(path)) {
        throw std::runtime_error("Image file not found: " + path);
    }

    std::ifstream file(path, std::ios::binary | std::ios::ate);
    if (!file) {
        throw std::runtime_error("Failed to open image: " + path);
    }

    auto size = file.tellg();
    file.seekg(0, std::ios::beg);

    std::vector<uint8_t> buffer(size);
    if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
        throw std::runtime_error("Failed to read image: " + path);
    }

    return buffer;
}

/**
 * Get image format from extension
 */
std::string get_format(const std::string& path) {
    fs::path p(path);
    std::string ext = p.extension().string();

    if (ext == ".png" || ext == ".PNG") return "png";
    if (ext == ".jpg" || ext == ".jpeg" || ext == ".JPG" || ext == ".JPEG") return "jpeg";
    if (ext == ".bmp" || ext == ".BMP") return "bmp";
    if (ext == ".gif" || ext == ".GIF") return "gif";
    if (ext == ".webp" || ext == ".WEBP") return "webp";

    return "unknown";
}

/**
 * Check if file is a supported image format
 */
bool is_image(const std::string& path) {
    std::string fmt = get_format(path);
    return fmt != "unknown";
}

/**
 * Base64 encode image data
 */
std::string to_base64(const std::vector<uint8_t>& data) {
    static const char* chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    std::string result;
    result.reserve((data.size() + 2) / 3 * 4);

    size_t i = 0;
    while (i < data.size()) {
        uint32_t n = data[i++] << 16;
        if (i < data.size()) n |= data[i++] << 8;
        if (i < data.size()) n |= data[i++];

        result += chars[(n >> 18) & 0x3F];
        result += chars[(n >> 12) & 0x3F];
        result += (i > data.size() + 1) ? '=' : chars[(n >> 6) & 0x3F];
        result += (i > data.size()) ? '=' : chars[n & 0x3F];
    }

    return result;
}

/**
 * Load image and encode as base64 data URL
 */
std::string to_data_url(const std::string& path) {
    auto data = read_file(path);
    std::string format = get_format(path);
    std::string base64 = to_base64(data);

    return "data:image/" + format + ";base64," + base64;
}

} // namespace image
} // namespace simi
