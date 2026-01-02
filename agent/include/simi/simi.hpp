#pragma once

/**
 * Simi Agent - OpenVINO-powered AI Coding Assistant
 *
 * A Claude Code-style agent with:
 * - Vision-Language Model (VLM) for multimodal understanding
 * - Tool use for file operations, shell commands, web access
 * - ReAct-style reasoning loop
 * - Streaming output support
 *
 * Quick start:
 *
 *   #include <simi/simi.hpp>
 *
 *   int main() {
 *       auto agent = simi::AgentBuilder()
 *           .with_vlm("models/qwen2.5-vl-3b")
 *           .with_default_tools()
 *           .build();
 *
 *       std::string response = agent->process("Hello! What can you do?");
 *       std::cout << response << std::endl;
 *
 *       // With image
 *       response = agent->process(
 *           "What's in this screenshot?",
 *           {"screenshot.png"}
 *       );
 *   }
 *
 * @version 1.0.0
 * @author Simi Team
 * @license MIT
 */

// Core types
#include "simi/types.hpp"

// Engines
#include "simi/vlm_engine.hpp"

// Tools
#include "simi/tools.hpp"

// Agent
#include "simi/agent.hpp"

// Version info
namespace simi {
    constexpr const char* VERSION = "1.0.0";
    constexpr int VERSION_MAJOR = 1;
    constexpr int VERSION_MINOR = 0;
    constexpr int VERSION_PATCH = 0;
}
