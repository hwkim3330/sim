#pragma once

#include "simi/types.hpp"
#include <memory>
#include <string>
#include <vector>
#include <functional>
#include <map>

namespace simi {

/**
 * Tool - Base class for all tools
 *
 * Tools are capabilities the agent can use to interact with the environment.
 */
class Tool {
public:
    virtual ~Tool() = default;

    /**
     * Get tool schema for LLM function calling
     */
    virtual ToolSchema get_schema() const = 0;

    /**
     * Execute the tool with given arguments
     */
    virtual ToolResult execute(const std::map<std::string, std::string>& args) = 0;

    /**
     * Check if tool is available on current system
     */
    virtual bool is_available() const { return true; }

    /**
     * Get tool name
     */
    std::string name() const { return get_schema().name; }
};

/**
 * ReadFile - Read file contents
 */
class ReadFileTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;

    // Config
    size_t max_file_size = 10 * 1024 * 1024;  // 10MB
    bool allow_binary = false;
};

/**
 * WriteFile - Write content to file
 */
class WriteFileTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;

    bool create_directories = true;
    bool backup_existing = false;
};

/**
 * EditFile - Edit file with search/replace
 */
class EditFileTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;
};

/**
 * ListDirectory - List directory contents
 */
class ListDirectoryTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;

    bool show_hidden = false;
    bool recursive = false;
    int max_depth = 3;
};

/**
 * SearchFiles - Search for files by pattern
 */
class SearchFilesTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;

    int max_results = 100;
};

/**
 * GrepTool - Search file contents
 */
class GrepTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;

    int max_results = 50;
    int context_lines = 2;
};

/**
 * ShellExec - Execute shell commands
 */
class ShellExecTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;
    bool is_available() const override;

    // Security settings
    std::vector<std::string> blocked_commands = {
        "rm -rf /", "format", "mkfs", "dd if=",
        ":(){", "fork bomb", "> /dev/sda"
    };
    int timeout_ms = 60000;  // 1 minute
    size_t max_output_size = 1024 * 1024;  // 1MB
    std::string working_directory;
};

/**
 * ScreenCapture - Capture screen or window
 */
class ScreenCaptureTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;
    bool is_available() const override;

    std::string output_directory = "screenshots";
    std::string format = "png";
};

/**
 * WebFetch - Fetch content from URL
 */
class WebFetchTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;
    bool is_available() const override;

    int timeout_ms = 30000;
    size_t max_response_size = 5 * 1024 * 1024;  // 5MB
    std::string user_agent = "Simi-Agent/1.0";
};

/**
 * WebSearch - Search the web
 */
class WebSearchTool : public Tool {
public:
    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;
    bool is_available() const override;

    int max_results = 10;
};

/**
 * AskUser - Ask user for input
 */
class AskUserTool : public Tool {
public:
    using InputCallback = std::function<std::string(const std::string& prompt, const std::vector<std::string>& options)>;

    ToolSchema get_schema() const override;
    ToolResult execute(const std::map<std::string, std::string>& args) override;

    InputCallback input_callback;
};

/**
 * ToolRegistry - Manages available tools
 */
class ToolRegistry {
public:
    ToolRegistry();
    ~ToolRegistry();

    /**
     * Register a tool
     */
    void register_tool(std::unique_ptr<Tool> tool);

    /**
     * Get tool by name
     */
    Tool* get_tool(const std::string& name);

    /**
     * Get all registered tools
     */
    std::vector<Tool*> get_all_tools() const;

    /**
     * Get schemas for all tools (for LLM)
     */
    std::vector<ToolSchema> get_all_schemas() const;

    /**
     * Format tools as system prompt
     */
    std::string format_tools_prompt() const;

    /**
     * Execute a tool call
     */
    ToolResult execute(const ToolCall& call);

    /**
     * Register default tools
     */
    void register_defaults();

private:
    std::map<std::string, std::unique_ptr<Tool>> tools_;
};

} // namespace simi
