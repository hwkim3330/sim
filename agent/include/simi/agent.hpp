#pragma once

#include "simi/types.hpp"
#include "simi/vlm_engine.hpp"
#include "simi/tools.hpp"
#include <memory>
#include <string>
#include <vector>
#include <atomic>

namespace simi {

/**
 * Agent - ReAct-style AI Agent with Vision capabilities
 *
 * Implements a reasoning + acting loop similar to Claude Code.
 * Uses VLM for multimodal understanding and tool calling.
 */
class Agent {
public:
    /**
     * Agent configuration
     */
    struct Config {
        // Model settings
        std::string vlm_model_path;
        std::string llm_model_path;  // Optional fallback
        VLMEngine::Device device = VLMEngine::Device::CPU;

        // Behavior settings
        int max_iterations = 50;        // Max tool calls per request
        int max_consecutive_errors = 3;
        bool verbose = false;
        bool stream_output = true;

        // System prompt
        std::string system_prompt = R"(You are Simi, an AI coding assistant. You help users with software engineering tasks.

You have access to tools that allow you to:
- Read, write, and edit files
- Execute shell commands
- Search files and code
- Capture screenshots and analyze images
- Fetch web content

When given a task:
1. Think step by step about what needs to be done
2. Use tools to gather information and make changes
3. Verify your work
4. Ask for clarification if needed

Always be helpful, accurate, and thorough.)";

        // Generation settings
        GenerationConfig generation;
    };

    /**
     * Constructor
     */
    explicit Agent(const Config& config);

    /**
     * Destructor
     */
    ~Agent();

    // Non-copyable
    Agent(const Agent&) = delete;
    Agent& operator=(const Agent&) = delete;

    /**
     * Process a user message and generate response
     *
     * This is the main entry point. The agent will:
     * 1. Parse the user message
     * 2. Decide what tools to use (if any)
     * 3. Execute tools and incorporate results
     * 4. Generate final response
     *
     * @param message User's message
     * @param images Optional images (paths or base64)
     * @return Agent's response
     */
    std::string process(
        const std::string& message,
        const std::vector<std::string>& images = {}
    );

    /**
     * Process with streaming output
     */
    void process_stream(
        const std::string& message,
        const std::vector<std::string>& images,
        StreamCallback on_token,
        ToolCallback on_tool = nullptr,
        StateCallback on_state = nullptr
    );

    /**
     * Reset conversation (clear history)
     */
    void reset();

    /**
     * Get conversation history
     */
    const std::vector<Message>& get_history() const;

    /**
     * Add message to history manually
     */
    void add_message(const Message& message);

    /**
     * Get current state
     */
    AgentState get_state() const;

    /**
     * Stop current processing
     */
    void stop();

    /**
     * Check if agent is busy
     */
    bool is_busy() const;

    /**
     * Get tool registry (for adding custom tools)
     */
    ToolRegistry& tools();

    /**
     * Get VLM engine
     */
    VLMEngine& vlm();

    /**
     * Set callbacks
     */
    void set_stream_callback(StreamCallback callback);
    void set_tool_callback(ToolCallback callback);
    void set_state_callback(StateCallback callback);

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;

    // ReAct loop
    std::string react_loop(
        const std::string& user_message,
        const std::vector<std::string>& images
    );

    // Parse tool calls from model output
    std::vector<ToolCall> parse_tool_calls(const std::string& response);

    // Format tool results for model
    std::string format_tool_results(const std::vector<std::pair<ToolCall, ToolResult>>& results);

    // Build prompt with history and tools
    std::string build_prompt(const std::vector<Message>& messages);
};

/**
 * AgentBuilder - Fluent API for agent construction
 */
class AgentBuilder {
public:
    AgentBuilder();

    AgentBuilder& with_vlm(const std::string& model_path);
    AgentBuilder& with_llm(const std::string& model_path);
    AgentBuilder& with_device(VLMEngine::Device device);
    AgentBuilder& with_system_prompt(const std::string& prompt);
    AgentBuilder& with_max_iterations(int max);
    AgentBuilder& with_verbose(bool verbose);
    AgentBuilder& with_streaming(bool stream);
    AgentBuilder& with_tool(std::unique_ptr<Tool> tool);
    AgentBuilder& with_default_tools();

    std::unique_ptr<Agent> build();

private:
    Agent::Config config_;
    std::vector<std::unique_ptr<Tool>> custom_tools_;
    bool use_default_tools_ = true;
};

} // namespace simi
