#include "simi/tools.hpp"
#include <array>
#include <memory>
#include <sstream>
#include <cstdio>
#include <thread>
#include <chrono>
#include <atomic>

#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#endif

namespace simi {

// ============================================================================
// ShellExecTool
// ============================================================================

ToolSchema ShellExecTool::get_schema() const {
    return {
        "shell",
        "Execute a shell command. Use for git, npm, build tools, etc.",
        {
            {"command", "string", "The command to execute", true, std::nullopt},
            {"working_dir", "string", "Working directory for the command", false, std::nullopt},
            {"timeout", "integer", "Timeout in milliseconds", false, "60000"}
        }
    };
}

bool ShellExecTool::is_available() const {
    return true;  // Shell is always available
}

ToolResult ShellExecTool::execute(const std::map<std::string, std::string>& args) {
    auto cmd_it = args.find("command");
    if (cmd_it == args.end()) {
        return {"", false, "", "command is required"};
    }

    std::string command = cmd_it->second;

    // Security check
    for (const auto& blocked : blocked_commands) {
        if (command.find(blocked) != std::string::npos) {
            return {"", false, "", "Command blocked for security: " + blocked};
        }
    }

    // Get timeout
    int timeout = timeout_ms;
    if (args.count("timeout")) {
        timeout = std::stoi(args.at("timeout"));
    }

    // Get working directory
    std::string work_dir = working_directory;
    if (args.count("working_dir")) {
        work_dir = args.at("working_dir");
    }

    std::ostringstream output;
    int exit_code = -1;

#ifdef _WIN32
    // Windows implementation
    SECURITY_ATTRIBUTES sa;
    sa.nLength = sizeof(SECURITY_ATTRIBUTES);
    sa.bInheritHandle = TRUE;
    sa.lpSecurityDescriptor = NULL;

    HANDLE stdout_read, stdout_write;
    if (!CreatePipe(&stdout_read, &stdout_write, &sa, 0)) {
        return {"", false, "", "Failed to create pipe"};
    }
    SetHandleInformation(stdout_read, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOA si = {0};
    si.cb = sizeof(STARTUPINFOA);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdOutput = stdout_write;
    si.hStdError = stdout_write;

    PROCESS_INFORMATION pi = {0};

    // Prepend cmd /c for Windows
    std::string full_cmd = "cmd /c " + command;

    BOOL success = CreateProcessA(
        NULL,
        const_cast<char*>(full_cmd.c_str()),
        NULL,
        NULL,
        TRUE,
        CREATE_NO_WINDOW,
        NULL,
        work_dir.empty() ? NULL : work_dir.c_str(),
        &si,
        &pi
    );

    CloseHandle(stdout_write);

    if (!success) {
        CloseHandle(stdout_read);
        return {"", false, "", "Failed to execute command"};
    }

    // Read output with timeout
    std::atomic<bool> done{false};
    std::string result_output;

    std::thread reader([&]() {
        char buffer[4096];
        DWORD bytes_read;
        while (ReadFile(stdout_read, buffer, sizeof(buffer) - 1, &bytes_read, NULL) && bytes_read > 0) {
            buffer[bytes_read] = '\0';
            result_output += buffer;
            if (result_output.size() > max_output_size) {
                result_output = result_output.substr(0, max_output_size) + "\n... (output truncated)";
                break;
            }
        }
        done = true;
    });

    // Wait with timeout
    DWORD wait_result = WaitForSingleObject(pi.hProcess, timeout);

    if (wait_result == WAIT_TIMEOUT) {
        TerminateProcess(pi.hProcess, 1);
        reader.join();
        CloseHandle(stdout_read);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return {"", false, result_output, "Command timed out after " + std::to_string(timeout) + "ms"};
    }

    reader.join();

    DWORD code;
    GetExitCodeProcess(pi.hProcess, &code);
    exit_code = static_cast<int>(code);

    CloseHandle(stdout_read);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    output << result_output;

#else
    // Unix implementation
    // Change to working directory if specified
    std::string full_cmd = command;
    if (!work_dir.empty()) {
        full_cmd = "cd '" + work_dir + "' && " + command;
    }

    // Redirect stderr to stdout
    full_cmd += " 2>&1";

    FILE* pipe = popen(full_cmd.c_str(), "r");
    if (!pipe) {
        return {"", false, "", "Failed to execute command"};
    }

    char buffer[4096];
    size_t total_read = 0;

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        output << buffer;
        total_read += strlen(buffer);
        if (total_read > max_output_size) {
            output << "\n... (output truncated)";
            break;
        }
    }

    exit_code = pclose(pipe);
    exit_code = WEXITSTATUS(exit_code);
#endif

    bool success_flag = (exit_code == 0);

    return {
        "",
        success_flag,
        output.str(),
        success_flag ? std::nullopt : std::make_optional("Exit code: " + std::to_string(exit_code))
    };
}

// ============================================================================
// AskUserTool
// ============================================================================

ToolSchema AskUserTool::get_schema() const {
    return {
        "ask_user",
        "Ask the user a question and wait for their response.",
        {
            {"question", "string", "The question to ask", true, std::nullopt},
            {"options", "array", "Optional list of choices", false, std::nullopt}
        }
    };
}

ToolResult AskUserTool::execute(const std::map<std::string, std::string>& args) {
    auto question_it = args.find("question");
    if (question_it == args.end()) {
        return {"", false, "", "question is required"};
    }

    if (!input_callback) {
        return {"", false, "", "No input callback configured"};
    }

    std::vector<std::string> options;
    if (args.count("options")) {
        // Parse options (comma-separated for simplicity)
        std::istringstream iss(args.at("options"));
        std::string option;
        while (std::getline(iss, option, ',')) {
            // Trim whitespace
            option.erase(0, option.find_first_not_of(" \t"));
            option.erase(option.find_last_not_of(" \t") + 1);
            if (!option.empty()) {
                options.push_back(option);
            }
        }
    }

    std::string response = input_callback(question_it->second, options);

    return {"", true, response, std::nullopt};
}

} // namespace simi
