#include "simi/tools.hpp"
#include <fstream>
#include <sstream>
#include <filesystem>
#include <regex>
#include <algorithm>

namespace fs = std::filesystem;

namespace simi {

// ============================================================================
// ReadFileTool
// ============================================================================

ToolSchema ReadFileTool::get_schema() const {
    return {
        "read_file",
        "Read the contents of a file. Returns the file content as text.",
        {
            {"file_path", "string", "Absolute path to the file to read", true, std::nullopt},
            {"offset", "integer", "Line number to start reading from (1-based)", false, "1"},
            {"limit", "integer", "Maximum number of lines to read", false, "2000"}
        }
    };
}

ToolResult ReadFileTool::execute(const std::map<std::string, std::string>& args) {
    auto it = args.find("file_path");
    if (it == args.end()) {
        return {"", false, "", "file_path is required"};
    }

    std::string file_path = it->second;

    // Check if file exists
    if (!fs::exists(file_path)) {
        return {"", false, "", "File not found: " + file_path};
    }

    // Check file size
    auto file_size = fs::file_size(file_path);
    if (file_size > max_file_size) {
        return {"", false, "", "File too large: " + std::to_string(file_size) + " bytes"};
    }

    // Parse offset and limit
    int offset = 1;
    int limit = 2000;
    if (args.count("offset")) {
        offset = std::stoi(args.at("offset"));
    }
    if (args.count("limit")) {
        limit = std::stoi(args.at("limit"));
    }

    // Read file
    std::ifstream file(file_path);
    if (!file) {
        return {"", false, "", "Failed to open file: " + file_path};
    }

    std::ostringstream result;
    std::string line;
    int line_num = 0;
    int lines_read = 0;

    while (std::getline(file, line) && lines_read < limit) {
        line_num++;
        if (line_num >= offset) {
            // Format with line number
            result << std::setw(6) << line_num << "\t" << line << "\n";
            lines_read++;
        }
    }

    return {"", true, result.str(), std::nullopt};
}

// ============================================================================
// WriteFileTool
// ============================================================================

ToolSchema WriteFileTool::get_schema() const {
    return {
        "write_file",
        "Write content to a file. Creates the file if it doesn't exist.",
        {
            {"file_path", "string", "Absolute path to the file to write", true, std::nullopt},
            {"content", "string", "Content to write to the file", true, std::nullopt}
        }
    };
}

ToolResult WriteFileTool::execute(const std::map<std::string, std::string>& args) {
    auto path_it = args.find("file_path");
    auto content_it = args.find("content");

    if (path_it == args.end()) {
        return {"", false, "", "file_path is required"};
    }
    if (content_it == args.end()) {
        return {"", false, "", "content is required"};
    }

    std::string file_path = path_it->second;
    std::string content = content_it->second;

    // Create directories if needed
    if (create_directories) {
        fs::path p(file_path);
        if (p.has_parent_path()) {
            fs::create_directories(p.parent_path());
        }
    }

    // Backup if exists
    if (backup_existing && fs::exists(file_path)) {
        fs::copy_file(file_path, file_path + ".bak", fs::copy_options::overwrite_existing);
    }

    // Write file
    std::ofstream file(file_path);
    if (!file) {
        return {"", false, "", "Failed to create file: " + file_path};
    }

    file << content;
    file.close();

    return {"", true, "File written successfully: " + file_path, std::nullopt};
}

// ============================================================================
// EditFileTool
// ============================================================================

ToolSchema EditFileTool::get_schema() const {
    return {
        "edit_file",
        "Edit a file by replacing text. The old_string must match exactly.",
        {
            {"file_path", "string", "Absolute path to the file to edit", true, std::nullopt},
            {"old_string", "string", "The exact text to find and replace", true, std::nullopt},
            {"new_string", "string", "The text to replace with", true, std::nullopt},
            {"replace_all", "boolean", "Replace all occurrences (default: false)", false, "false"}
        }
    };
}

ToolResult EditFileTool::execute(const std::map<std::string, std::string>& args) {
    auto path_it = args.find("file_path");
    auto old_it = args.find("old_string");
    auto new_it = args.find("new_string");

    if (path_it == args.end() || old_it == args.end() || new_it == args.end()) {
        return {"", false, "", "file_path, old_string, and new_string are required"};
    }

    std::string file_path = path_it->second;
    std::string old_string = old_it->second;
    std::string new_string = new_it->second;
    bool replace_all = args.count("replace_all") && args.at("replace_all") == "true";

    if (!fs::exists(file_path)) {
        return {"", false, "", "File not found: " + file_path};
    }

    // Read file
    std::ifstream in_file(file_path);
    if (!in_file) {
        return {"", false, "", "Failed to open file: " + file_path};
    }

    std::ostringstream buffer;
    buffer << in_file.rdbuf();
    std::string content = buffer.str();
    in_file.close();

    // Find and replace
    size_t count = 0;
    size_t pos = 0;

    if (replace_all) {
        while ((pos = content.find(old_string, pos)) != std::string::npos) {
            content.replace(pos, old_string.length(), new_string);
            pos += new_string.length();
            count++;
        }
    } else {
        pos = content.find(old_string);
        if (pos != std::string::npos) {
            content.replace(pos, old_string.length(), new_string);
            count = 1;
        }
    }

    if (count == 0) {
        return {"", false, "", "old_string not found in file"};
    }

    // Write back
    std::ofstream out_file(file_path);
    if (!out_file) {
        return {"", false, "", "Failed to write file: " + file_path};
    }

    out_file << content;
    out_file.close();

    return {"", true, "Replaced " + std::to_string(count) + " occurrence(s)", std::nullopt};
}

// ============================================================================
// ListDirectoryTool
// ============================================================================

ToolSchema ListDirectoryTool::get_schema() const {
    return {
        "list_directory",
        "List the contents of a directory.",
        {
            {"path", "string", "Directory path to list", true, std::nullopt},
            {"recursive", "boolean", "List recursively (default: false)", false, "false"},
            {"pattern", "string", "Glob pattern to filter files", false, std::nullopt}
        }
    };
}

ToolResult ListDirectoryTool::execute(const std::map<std::string, std::string>& args) {
    auto path_it = args.find("path");
    if (path_it == args.end()) {
        return {"", false, "", "path is required"};
    }

    std::string dir_path = path_it->second;
    bool is_recursive = args.count("recursive") && args.at("recursive") == "true";

    if (!fs::exists(dir_path)) {
        return {"", false, "", "Directory not found: " + dir_path};
    }

    if (!fs::is_directory(dir_path)) {
        return {"", false, "", "Not a directory: " + dir_path};
    }

    std::ostringstream result;
    int count = 0;

    auto list_entry = [&](const fs::directory_entry& entry) {
        if (!show_hidden && entry.path().filename().string()[0] == '.') {
            return;
        }

        std::string type = entry.is_directory() ? "[DIR]" : "[FILE]";
        result << type << " " << entry.path().string() << "\n";
        count++;
    };

    try {
        if (is_recursive) {
            for (const auto& entry : fs::recursive_directory_iterator(dir_path)) {
                list_entry(entry);
            }
        } else {
            for (const auto& entry : fs::directory_iterator(dir_path)) {
                list_entry(entry);
            }
        }
    } catch (const fs::filesystem_error& e) {
        return {"", false, "", "Filesystem error: " + std::string(e.what())};
    }

    result << "\nTotal: " << count << " items";

    return {"", true, result.str(), std::nullopt};
}

// ============================================================================
// SearchFilesTool
// ============================================================================

ToolSchema SearchFilesTool::get_schema() const {
    return {
        "search_files",
        "Search for files matching a glob pattern.",
        {
            {"pattern", "string", "Glob pattern (e.g., '*.cpp', 'src/**/*.ts')", true, std::nullopt},
            {"path", "string", "Directory to search in", false, "."}
        }
    };
}

ToolResult SearchFilesTool::execute(const std::map<std::string, std::string>& args) {
    auto pattern_it = args.find("pattern");
    if (pattern_it == args.end()) {
        return {"", false, "", "pattern is required"};
    }

    std::string pattern = pattern_it->second;
    std::string search_path = args.count("path") ? args.at("path") : ".";

    if (!fs::exists(search_path)) {
        return {"", false, "", "Directory not found: " + search_path};
    }

    // Convert glob to regex (simple conversion)
    std::string regex_pattern = pattern;
    // Escape special regex chars except * and ?
    regex_pattern = std::regex_replace(regex_pattern, std::regex("\\."), "\\.");
    regex_pattern = std::regex_replace(regex_pattern, std::regex("\\*\\*"), ".*");
    regex_pattern = std::regex_replace(regex_pattern, std::regex("\\*"), "[^/]*");
    regex_pattern = std::regex_replace(regex_pattern, std::regex("\\?"), ".");

    std::regex re(regex_pattern, std::regex::icase);

    std::ostringstream result;
    int count = 0;

    for (const auto& entry : fs::recursive_directory_iterator(search_path)) {
        if (count >= max_results) break;

        std::string path_str = entry.path().string();
        std::replace(path_str.begin(), path_str.end(), '\\', '/');

        if (std::regex_search(path_str, re)) {
            result << path_str << "\n";
            count++;
        }
    }

    result << "\nFound: " << count << " files";
    if (count >= max_results) {
        result << " (limited to " << max_results << ")";
    }

    return {"", true, result.str(), std::nullopt};
}

// ============================================================================
// GrepTool
// ============================================================================

ToolSchema GrepTool::get_schema() const {
    return {
        "grep",
        "Search for a pattern in file contents.",
        {
            {"pattern", "string", "Regex pattern to search for", true, std::nullopt},
            {"path", "string", "File or directory to search in", false, "."},
            {"glob", "string", "Glob pattern to filter files (e.g., '*.cpp')", false, std::nullopt}
        }
    };
}

ToolResult GrepTool::execute(const std::map<std::string, std::string>& args) {
    auto pattern_it = args.find("pattern");
    if (pattern_it == args.end()) {
        return {"", false, "", "pattern is required"};
    }

    std::string pattern = pattern_it->second;
    std::string search_path = args.count("path") ? args.at("path") : ".";

    std::regex re;
    try {
        re = std::regex(pattern, std::regex::icase);
    } catch (const std::regex_error& e) {
        return {"", false, "", "Invalid regex: " + std::string(e.what())};
    }

    std::ostringstream result;
    int match_count = 0;

    auto search_file = [&](const fs::path& file_path) {
        if (match_count >= max_results) return;

        std::ifstream file(file_path);
        if (!file) return;

        std::string line;
        int line_num = 0;

        while (std::getline(file, line) && match_count < max_results) {
            line_num++;
            if (std::regex_search(line, re)) {
                result << file_path.string() << ":" << line_num << ": " << line << "\n";
                match_count++;
            }
        }
    };

    if (fs::is_regular_file(search_path)) {
        search_file(search_path);
    } else if (fs::is_directory(search_path)) {
        for (const auto& entry : fs::recursive_directory_iterator(search_path)) {
            if (match_count >= max_results) break;
            if (entry.is_regular_file()) {
                search_file(entry.path());
            }
        }
    }

    result << "\nMatches: " << match_count;
    if (match_count >= max_results) {
        result << " (limited to " << max_results << ")";
    }

    return {"", true, result.str(), std::nullopt};
}

} // namespace simi
