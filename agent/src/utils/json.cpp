// Minimal JSON utilities
// For production, consider using nlohmann/json or rapidjson

#include <string>
#include <map>
#include <vector>
#include <sstream>
#include <variant>

namespace simi {
namespace json {

using Value = std::variant<
    std::nullptr_t,
    bool,
    int64_t,
    double,
    std::string,
    std::vector<std::string>,
    std::map<std::string, std::string>
>;

/**
 * Simple JSON serialization
 */
std::string to_json(const std::map<std::string, std::string>& obj) {
    std::ostringstream oss;
    oss << "{";
    bool first = true;
    for (const auto& [key, value] : obj) {
        if (!first) oss << ",";
        first = false;
        oss << "\"" << key << "\":\"" << value << "\"";
    }
    oss << "}";
    return oss.str();
}

/**
 * Simple JSON array serialization
 */
std::string to_json(const std::vector<std::string>& arr) {
    std::ostringstream oss;
    oss << "[";
    for (size_t i = 0; i < arr.size(); ++i) {
        if (i > 0) oss << ",";
        oss << "\"" << arr[i] << "\"";
    }
    oss << "]";
    return oss.str();
}

/**
 * Parse simple JSON object
 * Note: This is a minimal implementation for basic cases
 */
std::map<std::string, std::string> parse_object(const std::string& json) {
    std::map<std::string, std::string> result;
    // Very basic parsing - not production ready
    // For real use, integrate a proper JSON library
    return result;
}

} // namespace json
} // namespace simi
