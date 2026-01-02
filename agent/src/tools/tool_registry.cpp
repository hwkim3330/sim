#include "simi/tools.hpp"
#include <sstream>

namespace simi {

ToolRegistry::ToolRegistry() = default;
ToolRegistry::~ToolRegistry() = default;

void ToolRegistry::register_tool(std::unique_ptr<Tool> tool) {
    if (tool) {
        std::string name = tool->name();
        tools_[name] = std::move(tool);
    }
}

Tool* ToolRegistry::get_tool(const std::string& name) {
    auto it = tools_.find(name);
    return it != tools_.end() ? it->second.get() : nullptr;
}

std::vector<Tool*> ToolRegistry::get_all_tools() const {
    std::vector<Tool*> result;
    for (const auto& [name, tool] : tools_) {
        if (tool->is_available()) {
            result.push_back(tool.get());
        }
    }
    return result;
}

std::vector<ToolSchema> ToolRegistry::get_all_schemas() const {
    std::vector<ToolSchema> result;
    for (const auto& [name, tool] : tools_) {
        if (tool->is_available()) {
            result.push_back(tool->get_schema());
        }
    }
    return result;
}

std::string ToolRegistry::format_tools_prompt() const {
    std::ostringstream oss;
    oss << "## Available Tools\n\n";
    oss << "You can use these tools by outputting a tool call in this format:\n";
    oss << "```\n";
    oss << "<tool_call>\n";
    oss << "name: tool_name\n";
    oss << "arguments:\n";
    oss << "  param1: value1\n";
    oss << "  param2: value2\n";
    oss << "</tool_call>\n";
    oss << "```\n\n";

    for (const auto& [name, tool] : tools_) {
        if (!tool->is_available()) continue;

        auto schema = tool->get_schema();
        oss << "### " << schema.name << "\n";
        oss << schema.description << "\n\n";
        oss << "**Parameters:**\n";

        for (const auto& param : schema.parameters) {
            oss << "- `" << param.name << "` (" << param.type;
            if (param.required) {
                oss << ", required";
            }
            oss << "): " << param.description;
            if (param.default_value) {
                oss << " (default: " << *param.default_value << ")";
            }
            oss << "\n";
        }
        oss << "\n";
    }

    return oss.str();
}

ToolResult ToolRegistry::execute(const ToolCall& call) {
    auto* tool = get_tool(call.name);
    if (!tool) {
        return {call.id, false, "", "Unknown tool: " + call.name};
    }

    if (!tool->is_available()) {
        return {call.id, false, "", "Tool not available: " + call.name};
    }

    try {
        auto result = tool->execute(call.arguments);
        result.call_id = call.id;
        return result;
    } catch (const std::exception& e) {
        return {call.id, false, "", "Tool execution failed: " + std::string(e.what())};
    }
}

void ToolRegistry::register_defaults() {
    register_tool(std::make_unique<ReadFileTool>());
    register_tool(std::make_unique<WriteFileTool>());
    register_tool(std::make_unique<EditFileTool>());
    register_tool(std::make_unique<ListDirectoryTool>());
    register_tool(std::make_unique<SearchFilesTool>());
    register_tool(std::make_unique<GrepTool>());
    register_tool(std::make_unique<ShellExecTool>());
    register_tool(std::make_unique<ScreenCaptureTool>());
    register_tool(std::make_unique<WebFetchTool>());
    register_tool(std::make_unique<AskUserTool>());
}

} // namespace simi
