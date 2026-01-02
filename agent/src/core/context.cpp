#include "simi/types.hpp"
#include <sstream>
#include <fstream>
#include <filesystem>

namespace fs = std::filesystem;

namespace simi {

/**
 * Context - Manages conversation context and memory
 */
class Context {
public:
    Context() = default;

    /**
     * Add a message to history
     */
    void add_message(const Message& msg) {
        messages_.push_back(msg);
        trim_if_needed();
    }

    /**
     * Get all messages
     */
    const std::vector<Message>& messages() const {
        return messages_;
    }

    /**
     * Clear all messages except system
     */
    void clear() {
        messages_.erase(
            std::remove_if(messages_.begin(), messages_.end(),
                [](const Message& m) { return m.role != Role::System; }),
            messages_.end()
        );
    }

    /**
     * Set max tokens to keep
     */
    void set_max_tokens(size_t max) {
        max_tokens_ = max;
    }

    /**
     * Estimate token count (rough approximation)
     */
    size_t estimate_tokens() const {
        size_t total = 0;
        for (const auto& msg : messages_) {
            // Rough estimate: ~4 chars per token
            total += msg.content.length() / 4;
        }
        return total;
    }

    /**
     * Save context to file
     */
    bool save(const std::string& path) const {
        std::ofstream file(path);
        if (!file) return false;

        for (const auto& msg : messages_) {
            file << static_cast<int>(msg.role) << "\n";
            file << msg.content.length() << "\n";
            file << msg.content << "\n";
        }

        return true;
    }

    /**
     * Load context from file
     */
    bool load(const std::string& path) {
        if (!fs::exists(path)) return false;

        std::ifstream file(path);
        if (!file) return false;

        messages_.clear();

        int role_int;
        size_t content_len;

        while (file >> role_int >> content_len) {
            file.ignore();  // Skip newline
            std::string content(content_len, '\0');
            file.read(&content[0], content_len);
            file.ignore();  // Skip newline

            Message msg;
            msg.role = static_cast<Role>(role_int);
            msg.content = content;
            messages_.push_back(msg);
        }

        return true;
    }

    /**
     * Format messages for display
     */
    std::string format() const {
        std::ostringstream oss;
        for (const auto& msg : messages_) {
            switch (msg.role) {
                case Role::System:
                    oss << "[System] ";
                    break;
                case Role::User:
                    oss << "[User] ";
                    break;
                case Role::Assistant:
                    oss << "[Assistant] ";
                    break;
                case Role::Tool:
                    oss << "[Tool] ";
                    break;
            }
            oss << msg.content << "\n\n";
        }
        return oss.str();
    }

private:
    std::vector<Message> messages_;
    size_t max_tokens_ = 16000;  // Default context limit

    void trim_if_needed() {
        while (estimate_tokens() > max_tokens_ && messages_.size() > 2) {
            // Keep system message, remove oldest user/assistant pair
            auto it = messages_.begin();
            if (it->role == Role::System) ++it;
            if (it != messages_.end()) {
                messages_.erase(it);
            }
        }
    }
};

} // namespace simi
