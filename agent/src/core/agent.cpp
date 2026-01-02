#include "simi/agent.hpp"
#include <sstream>
#include <regex>
#include <iostream>
#include <atomic>

namespace simi {

// ============================================================================
// Agent Implementation
// ============================================================================

struct Agent::Impl {
    Config config;
    std::unique_ptr<VLMEngine> vlm;
    std::unique_ptr<LLMEngine> llm;
    ToolRegistry tools;

    std::vector<Message> history;
    std::atomic<AgentState> state{AgentState::Idle};
    std::atomic<bool> stop_requested{false};

    // Callbacks
    StreamCallback stream_callback;
    ToolCallback tool_callback;
    StateCallback state_callback;

    void set_state(AgentState new_state, const std::string& message = "") {
        state = new_state;
        if (state_callback) {
            state_callback(new_state, message);
        }
    }
};

Agent::Agent(const Config& config)
    : impl_(std::make_unique<Impl>())
{
    impl_->config = config;

    // Load VLM
    if (!config.vlm_model_path.empty()) {
        VLMEngine::Config vlm_config;
        vlm_config.model_path = config.vlm_model_path;
        vlm_config.device = config.device;
        impl_->vlm = std::make_unique<VLMEngine>(vlm_config);
    }

    // Load LLM (optional fallback)
    if (!config.llm_model_path.empty()) {
        LLMEngine::Config llm_config;
        llm_config.model_path = config.llm_model_path;
        llm_config.device = config.device;
        impl_->llm = std::make_unique<LLMEngine>(llm_config);
    }

    // Register default tools
    impl_->tools.register_defaults();
}

Agent::~Agent() = default;

std::string Agent::process(
    const std::string& message,
    const std::vector<std::string>& images
) {
    impl_->stop_requested = false;
    impl_->set_state(AgentState::Thinking, "Processing message...");

    // Add user message to history
    impl_->history.push_back(Message::user(message, images));

    // Run ReAct loop
    std::string response = react_loop(message, images);

    // Add assistant response to history
    impl_->history.push_back(Message::assistant(response));

    impl_->set_state(AgentState::Done);
    return response;
}

void Agent::process_stream(
    const std::string& message,
    const std::vector<std::string>& images,
    StreamCallback on_token,
    ToolCallback on_tool,
    StateCallback on_state
) {
    impl_->stream_callback = on_token;
    impl_->tool_callback = on_tool;
    impl_->state_callback = on_state;

    process(message, images);
}

void Agent::reset() {
    impl_->history.clear();
    impl_->state = AgentState::Idle;
    impl_->stop_requested = false;

    if (impl_->vlm) {
        impl_->vlm->start_chat();
    }
}

const std::vector<Message>& Agent::get_history() const {
    return impl_->history;
}

void Agent::add_message(const Message& message) {
    impl_->history.push_back(message);
}

AgentState Agent::get_state() const {
    return impl_->state.load();
}

void Agent::stop() {
    impl_->stop_requested = true;
}

bool Agent::is_busy() const {
    auto state = impl_->state.load();
    return state == AgentState::Thinking || state == AgentState::CallingTool;
}

ToolRegistry& Agent::tools() {
    return impl_->tools;
}

VLMEngine& Agent::vlm() {
    if (!impl_->vlm) {
        throw std::runtime_error("VLM not loaded");
    }
    return *impl_->vlm;
}

void Agent::set_stream_callback(StreamCallback callback) {
    impl_->stream_callback = callback;
}

void Agent::set_tool_callback(ToolCallback callback) {
    impl_->tool_callback = callback;
}

void Agent::set_state_callback(StateCallback callback) {
    impl_->state_callback = callback;
}

std::string Agent::react_loop(
    const std::string& user_message,
    const std::vector<std::string>& images
) {
    int iterations = 0;
    int consecutive_errors = 0;
    std::ostringstream final_response;

    while (iterations < impl_->config.max_iterations && !impl_->stop_requested) {
        iterations++;

        // Build prompt
        std::string prompt = build_prompt(impl_->history);

        // Generate response
        std::string response;
        if (impl_->vlm && impl_->vlm->is_loaded()) {
            if (impl_->stream_callback) {
                std::ostringstream oss;
                impl_->vlm->generate_stream(prompt, images, [&](const std::string& token) {
                    oss << token;
                    impl_->stream_callback(token);
                }, impl_->config.generation);
                response = oss.str();
            } else {
                response = impl_->vlm->generate(prompt, images, impl_->config.generation);
            }
        } else if (impl_->llm && impl_->llm->is_loaded()) {
            response = impl_->llm->generate(prompt, impl_->config.generation);
        } else {
            throw std::runtime_error("No model loaded");
        }

        // Check for tool calls
        auto tool_calls = parse_tool_calls(response);

        if (tool_calls.empty()) {
            // No tool calls, return response
            final_response << response;
            break;
        }

        // Execute tool calls
        impl_->set_state(AgentState::CallingTool, "Executing tools...");

        std::vector<std::pair<ToolCall, ToolResult>> results;
        for (const auto& call : tool_calls) {
            if (impl_->stop_requested) break;

            auto result = impl_->tools.execute(call);
            results.push_back({call, result});

            if (impl_->tool_callback) {
                impl_->tool_callback(call, result);
            }

            if (!result.success) {
                consecutive_errors++;
                if (consecutive_errors >= impl_->config.max_consecutive_errors) {
                    final_response << "Too many consecutive errors. Stopping.\n";
                    final_response << "Last error: " << result.error.value_or("Unknown error");
                    break;
                }
            } else {
                consecutive_errors = 0;
            }
        }

        // Add tool results to history
        std::string tool_results = format_tool_results(results);
        impl_->history.push_back(Message::tool_result("tools", "", tool_results));

        impl_->set_state(AgentState::Thinking, "Processing tool results...");
    }

    if (iterations >= impl_->config.max_iterations) {
        final_response << "\n[Reached maximum iterations]";
    }

    return final_response.str();
}

std::vector<ToolCall> Agent::parse_tool_calls(const std::string& response) {
    std::vector<ToolCall> calls;

    // Parse tool calls in format:
    // <tool_call>
    // name: tool_name
    // arguments:
    //   param: value
    // </tool_call>

    std::regex tool_regex(R"(<tool_call>\s*name:\s*(\w+)\s*arguments:\s*([\s\S]*?)</tool_call>)");
    std::sregex_iterator it(response.begin(), response.end(), tool_regex);
    std::sregex_iterator end;

    int call_id = 0;
    while (it != end) {
        std::smatch match = *it;
        ToolCall call;
        call.id = "call_" + std::to_string(call_id++);
        call.name = match[1].str();

        // Parse arguments (simple YAML-like format)
        std::string args_str = match[2].str();
        std::regex arg_regex(R"((\w+):\s*(.+))");
        std::sregex_iterator arg_it(args_str.begin(), args_str.end(), arg_regex);

        while (arg_it != end) {
            std::smatch arg_match = *arg_it;
            std::string key = arg_match[1].str();
            std::string value = arg_match[2].str();
            // Trim whitespace
            value.erase(0, value.find_first_not_of(" \t\n\r"));
            value.erase(value.find_last_not_of(" \t\n\r") + 1);
            call.arguments[key] = value;
            ++arg_it;
        }

        calls.push_back(call);
        ++it;
    }

    return calls;
}

std::string Agent::format_tool_results(const std::vector<std::pair<ToolCall, ToolResult>>& results) {
    std::ostringstream oss;
    oss << "Tool Results:\n";

    for (const auto& [call, result] : results) {
        oss << "\n### " << call.name << " (id: " << call.id << ")\n";
        if (result.success) {
            oss << "Status: Success\n";
            oss << "Output:\n" << result.output << "\n";
        } else {
            oss << "Status: Failed\n";
            oss << "Error: " << result.error.value_or("Unknown error") << "\n";
            if (!result.output.empty()) {
                oss << "Output:\n" << result.output << "\n";
            }
        }
    }

    return oss.str();
}

std::string Agent::build_prompt(const std::vector<Message>& messages) {
    std::ostringstream oss;

    // System prompt with tools
    oss << "<|im_start|>system\n";
    oss << impl_->config.system_prompt << "\n\n";
    oss << impl_->tools.format_tools_prompt();
    oss << "<|im_end|>\n";

    // Message history
    for (const auto& msg : messages) {
        switch (msg.role) {
            case Role::User:
                oss << "<|im_start|>user\n";
                for (size_t i = 0; i < msg.images.size(); ++i) {
                    oss << "<|vision_start|><|image_pad|><|vision_end|>";
                }
                oss << msg.content << "<|im_end|>\n";
                break;
            case Role::Assistant:
                oss << "<|im_start|>assistant\n" << msg.content << "<|im_end|>\n";
                break;
            case Role::Tool:
                oss << "<|im_start|>tool\n" << msg.content << "<|im_end|>\n";
                break;
            default:
                break;
        }
    }

    // Start assistant turn
    oss << "<|im_start|>assistant\n";

    return oss.str();
}

// ============================================================================
// AgentBuilder Implementation
// ============================================================================

AgentBuilder::AgentBuilder() {
    config_.generation.max_new_tokens = 2048;
    config_.generation.temperature = 0.7f;
}

AgentBuilder& AgentBuilder::with_vlm(const std::string& model_path) {
    config_.vlm_model_path = model_path;
    return *this;
}

AgentBuilder& AgentBuilder::with_llm(const std::string& model_path) {
    config_.llm_model_path = model_path;
    return *this;
}

AgentBuilder& AgentBuilder::with_device(VLMEngine::Device device) {
    config_.device = device;
    return *this;
}

AgentBuilder& AgentBuilder::with_system_prompt(const std::string& prompt) {
    config_.system_prompt = prompt;
    return *this;
}

AgentBuilder& AgentBuilder::with_max_iterations(int max) {
    config_.max_iterations = max;
    return *this;
}

AgentBuilder& AgentBuilder::with_verbose(bool verbose) {
    config_.verbose = verbose;
    return *this;
}

AgentBuilder& AgentBuilder::with_streaming(bool stream) {
    config_.stream_output = stream;
    return *this;
}

AgentBuilder& AgentBuilder::with_tool(std::unique_ptr<Tool> tool) {
    custom_tools_.push_back(std::move(tool));
    return *this;
}

AgentBuilder& AgentBuilder::with_default_tools() {
    use_default_tools_ = true;
    return *this;
}

std::unique_ptr<Agent> AgentBuilder::build() {
    auto agent = std::make_unique<Agent>(config_);

    // Register custom tools
    for (auto& tool : custom_tools_) {
        agent->tools().register_tool(std::move(tool));
    }

    return agent;
}

} // namespace simi
