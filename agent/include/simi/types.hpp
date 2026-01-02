#pragma once

#include <string>
#include <vector>
#include <variant>
#include <optional>
#include <functional>
#include <memory>
#include <map>

namespace simi {

// Forward declarations
class Agent;
class Tool;
class VLMEngine;

// Basic types
using Json = std::map<std::string, std::variant<
    std::string,
    int,
    double,
    bool,
    std::vector<std::string>,
    std::nullptr_t
>>;

// Message types
enum class Role {
    System,
    User,
    Assistant,
    Tool
};

struct Message {
    Role role;
    std::string content;
    std::optional<std::string> tool_name;
    std::optional<std::string> tool_call_id;
    std::vector<std::string> images;  // Base64 or file paths

    static Message system(const std::string& content) {
        return {Role::System, content, std::nullopt, std::nullopt, {}};
    }

    static Message user(const std::string& content, const std::vector<std::string>& images = {}) {
        return {Role::User, content, std::nullopt, std::nullopt, images};
    }

    static Message assistant(const std::string& content) {
        return {Role::Assistant, content, std::nullopt, std::nullopt, {}};
    }

    static Message tool_result(const std::string& name, const std::string& call_id, const std::string& result) {
        return {Role::Tool, result, name, call_id, {}};
    }
};

// Tool types
struct ToolParameter {
    std::string name;
    std::string type;  // "string", "integer", "boolean", "array"
    std::string description;
    bool required = true;
    std::optional<std::string> default_value;
};

struct ToolSchema {
    std::string name;
    std::string description;
    std::vector<ToolParameter> parameters;
};

struct ToolCall {
    std::string id;
    std::string name;
    std::map<std::string, std::string> arguments;
};

struct ToolResult {
    std::string call_id;
    bool success;
    std::string output;
    std::optional<std::string> error;
};

// Generation config
struct GenerationConfig {
    int max_new_tokens = 2048;
    float temperature = 0.7f;
    float top_p = 0.9f;
    int top_k = 50;
    bool do_sample = true;
    std::vector<std::string> stop_sequences = {"</tool_call>", "\nUser:", "\nHuman:"};
};

// Agent state
enum class AgentState {
    Idle,
    Thinking,
    CallingTool,
    WaitingForUser,
    Error,
    Done
};

// Callback types
using StreamCallback = std::function<void(const std::string& token)>;
using ToolCallback = std::function<void(const ToolCall& call, const ToolResult& result)>;
using StateCallback = std::function<void(AgentState state, const std::string& message)>;

} // namespace simi
