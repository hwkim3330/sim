/**
 * Simi Agent - CLI Entry Point
 *
 * An AI coding assistant powered by OpenVINO
 */

#include "simi/simi.hpp"
#include <iostream>
#include <string>
#include <vector>
#include <filesystem>
#include <csignal>
#include <atomic>

#ifdef _WIN32
#include <windows.h>
#define ENABLE_VIRTUAL_TERMINAL_PROCESSING 0x0004
#endif

namespace fs = std::filesystem;

// Global agent pointer for signal handling
static std::atomic<bool> g_running{true};
static simi::Agent* g_agent = nullptr;

// ANSI color codes
namespace color {
    const char* reset  = "\033[0m";
    const char* bold   = "\033[1m";
    const char* dim    = "\033[2m";
    const char* red    = "\033[31m";
    const char* green  = "\033[32m";
    const char* yellow = "\033[33m";
    const char* blue   = "\033[34m";
    const char* cyan   = "\033[36m";
    const char* gray   = "\033[90m";
}

void enable_ansi_colors() {
#ifdef _WIN32
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD dwMode = 0;
    GetConsoleMode(hOut, &dwMode);
    SetConsoleMode(hOut, dwMode | ENABLE_VIRTUAL_TERMINAL_PROCESSING);
    SetConsoleOutputCP(CP_UTF8);
#endif
}

void signal_handler(int signal) {
    if (signal == SIGINT) {
        std::cout << "\n" << color::yellow << "Interrupted." << color::reset << std::endl;
        if (g_agent) {
            g_agent->stop();
        }
        g_running = false;
    }
}

void print_banner() {
    std::cout << color::cyan << R"(
   _____ _           _    _                    _
  / ____(_)         (_)  / \   __ _  ___ _ __ | |_
  \___ \ _ _ __ ___  _  / _ \ / _` |/ _ \ '_ \| __|
   ___) | | '_ ` _ \| |/ ___ \ (_| |  __/ | | | |_
  |____/|_| |_| |_| |_/_/   \_\__, |\___|_| |_|\__|
                               __/ |
                              |___/
)" << color::reset << std::endl;

    std::cout << color::dim << "  OpenVINO-powered AI Coding Assistant" << color::reset << std::endl;
    std::cout << color::dim << "  Version " << simi::VERSION << color::reset << std::endl;
    std::cout << std::endl;
}

void print_help() {
    std::cout << color::cyan << "Commands:" << color::reset << std::endl;
    std::cout << "  " << color::bold << "/help" << color::reset << "     Show this help message" << std::endl;
    std::cout << "  " << color::bold << "/clear" << color::reset << "    Clear conversation history" << std::endl;
    std::cout << "  " << color::bold << "/image" << color::reset << "    Attach image to next message" << std::endl;
    std::cout << "  " << color::bold << "/history" << color::reset << "  Show conversation history" << std::endl;
    std::cout << "  " << color::bold << "/exit" << color::reset << "     Exit the program" << std::endl;
    std::cout << std::endl;
    std::cout << color::dim << "Type a message and press Enter to chat." << color::reset << std::endl;
    std::cout << color::dim << "Press Ctrl+C to interrupt generation." << color::reset << std::endl;
    std::cout << std::endl;
}

void print_usage() {
    std::cout << "Usage: simi [options]" << std::endl;
    std::cout << std::endl;
    std::cout << "Options:" << std::endl;
    std::cout << "  -m, --model <path>    Path to VLM model directory" << std::endl;
    std::cout << "  -d, --device <dev>    Device to use (CPU, GPU, NPU, AUTO)" << std::endl;
    std::cout << "  -v, --verbose         Enable verbose output" << std::endl;
    std::cout << "  -h, --help            Show this help message" << std::endl;
    std::cout << "  --version             Show version information" << std::endl;
    std::cout << std::endl;
    std::cout << "Examples:" << std::endl;
    std::cout << "  simi -m models/qwen2.5-vl-3b" << std::endl;
    std::cout << "  simi -m models/qwen2.5-vl-3b -d GPU" << std::endl;
}

struct Options {
    std::string model_path = "models/qwen2.5-vl-3b-instruct";
    simi::VLMEngine::Device device = simi::VLMEngine::Device::CPU;
    bool verbose = false;
    bool show_help = false;
    bool show_version = false;
};

Options parse_args(int argc, char* argv[]) {
    Options opts;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];

        if (arg == "-h" || arg == "--help") {
            opts.show_help = true;
        } else if (arg == "--version") {
            opts.show_version = true;
        } else if (arg == "-v" || arg == "--verbose") {
            opts.verbose = true;
        } else if ((arg == "-m" || arg == "--model") && i + 1 < argc) {
            opts.model_path = argv[++i];
        } else if ((arg == "-d" || arg == "--device") && i + 1 < argc) {
            std::string dev = argv[++i];
            if (dev == "GPU") opts.device = simi::VLMEngine::Device::GPU;
            else if (dev == "NPU") opts.device = simi::VLMEngine::Device::NPU;
            else if (dev == "AUTO") opts.device = simi::VLMEngine::Device::AUTO;
            else opts.device = simi::VLMEngine::Device::CPU;
        }
    }

    return opts;
}

int main(int argc, char* argv[]) {
    enable_ansi_colors();

    auto opts = parse_args(argc, argv);

    if (opts.show_help) {
        print_usage();
        return 0;
    }

    if (opts.show_version) {
        std::cout << "Simi Agent v" << simi::VERSION << std::endl;
        return 0;
    }

    print_banner();

    // Check if model exists
    if (!fs::exists(opts.model_path)) {
        std::cout << color::red << "Error: Model not found at: " << opts.model_path << color::reset << std::endl;
        std::cout << std::endl;
        std::cout << "To download the model, run:" << std::endl;
        std::cout << color::cyan << "  optimum-cli export openvino --model Qwen/Qwen2.5-VL-3B-Instruct \\" << std::endl;
        std::cout << "      --weight-format int4 --trust-remote-code " << opts.model_path << color::reset << std::endl;
        std::cout << std::endl;
        return 1;
    }

    // Setup signal handler
    std::signal(SIGINT, signal_handler);

    // Create agent
    std::cout << color::dim << "Loading model from: " << opts.model_path << color::reset << std::endl;
    std::cout << color::dim << "Device: " << simi::VLMEngine::device_to_string(opts.device) << color::reset << std::endl;
    std::cout << std::endl;

    try {
        auto agent = simi::AgentBuilder()
            .with_vlm(opts.model_path)
            .with_device(opts.device)
            .with_verbose(opts.verbose)
            .with_streaming(true)
            .with_default_tools()
            .build();

        g_agent = agent.get();

        print_help();

        std::vector<std::string> pending_images;

        // Main loop
        while (g_running) {
            // Print prompt
            std::cout << color::green << color::bold << "You: " << color::reset;
            std::cout.flush();

            // Read input
            std::string input;
            if (!std::getline(std::cin, input)) {
                break;  // EOF
            }

            if (input.empty()) continue;

            // Handle commands
            if (input[0] == '/') {
                if (input == "/exit" || input == "/quit") {
                    break;
                } else if (input == "/help") {
                    print_help();
                } else if (input == "/clear") {
                    agent->reset();
                    pending_images.clear();
                    std::cout << color::dim << "Conversation cleared." << color::reset << std::endl;
                } else if (input == "/history") {
                    std::cout << color::dim << "--- History ---" << color::reset << std::endl;
                    for (const auto& msg : agent->get_history()) {
                        const char* prefix = "";
                        switch (msg.role) {
                            case simi::Role::System: prefix = "[System] "; break;
                            case simi::Role::User: prefix = "[User] "; break;
                            case simi::Role::Assistant: prefix = "[Assistant] "; break;
                            case simi::Role::Tool: prefix = "[Tool] "; break;
                        }
                        std::cout << color::cyan << prefix << color::reset << msg.content << std::endl;
                    }
                    std::cout << color::dim << "---------------" << color::reset << std::endl;
                } else if (input.rfind("/image ", 0) == 0) {
                    std::string path = input.substr(7);
                    if (fs::exists(path)) {
                        pending_images.push_back(path);
                        std::cout << color::dim << "Image attached: " << path << color::reset << std::endl;
                    } else {
                        std::cout << color::red << "Image not found: " << path << color::reset << std::endl;
                    }
                } else {
                    std::cout << color::red << "Unknown command: " << input << color::reset << std::endl;
                }
                continue;
            }

            // Process message
            std::cout << color::blue << color::bold << "Simi: " << color::reset;
            std::cout.flush();

            try {
                agent->process_stream(
                    input,
                    pending_images,
                    // Stream callback
                    [](const std::string& token) {
                        std::cout << token;
                        std::cout.flush();
                    },
                    // Tool callback
                    [&opts](const simi::ToolCall& call, const simi::ToolResult& result) {
                        if (opts.verbose) {
                            std::cout << std::endl << color::dim << "[Tool: " << call.name << "] " << color::reset;
                            if (result.success) {
                                std::cout << color::green << "OK" << color::reset;
                            } else {
                                std::cout << color::red << "Failed: " << result.error.value_or("Unknown") << color::reset;
                            }
                            std::cout << std::endl;
                        }
                    },
                    // State callback
                    [&opts](simi::AgentState state, const std::string& msg) {
                        if (opts.verbose && !msg.empty()) {
                            std::cout << color::dim << "[" << msg << "]" << color::reset << std::endl;
                        }
                    }
                );

                std::cout << std::endl << std::endl;
                pending_images.clear();

            } catch (const std::exception& e) {
                std::cout << std::endl;
                std::cout << color::red << "Error: " << e.what() << color::reset << std::endl;
            }
        }

        std::cout << color::cyan << "Goodbye!" << color::reset << std::endl;

    } catch (const std::exception& e) {
        std::cout << color::red << "Fatal error: " << e.what() << color::reset << std::endl;
        return 1;
    }

    return 0;
}
