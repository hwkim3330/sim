#pragma once

#include "simi/types.hpp"
#include <openvino/genai/visual_language/pipeline.hpp>
#include <memory>
#include <string>
#include <vector>

namespace simi {

/**
 * VLMEngine - OpenVINO Vision-Language Model Engine
 *
 * Wraps OpenVINO GenAI VLMPipeline for multimodal inference.
 * Supports text + image inputs with conversation history.
 */
class VLMEngine {
public:
    /**
     * Supported devices for inference
     */
    enum class Device {
        CPU,
        GPU,
        NPU,
        AUTO  // Let OpenVINO decide
    };

    /**
     * Model configuration
     */
    struct Config {
        std::string model_path;
        Device device = Device::CPU;
        bool use_cache = true;       // Use KV-cache for faster inference
        int num_threads = 0;         // 0 = auto
        bool enable_mmap = true;     // Memory-map weights
    };

    /**
     * Constructor - Load model from path
     */
    explicit VLMEngine(const Config& config);

    /**
     * Destructor
     */
    ~VLMEngine();

    // Non-copyable, movable
    VLMEngine(const VLMEngine&) = delete;
    VLMEngine& operator=(const VLMEngine&) = delete;
    VLMEngine(VLMEngine&&) noexcept;
    VLMEngine& operator=(VLMEngine&&) noexcept;

    /**
     * Generate response from text prompt
     */
    std::string generate(
        const std::string& prompt,
        const GenerationConfig& config = {}
    );

    /**
     * Generate response from text + images
     */
    std::string generate(
        const std::string& prompt,
        const std::vector<std::string>& image_paths,
        const GenerationConfig& config = {}
    );

    /**
     * Generate with streaming output
     */
    void generate_stream(
        const std::string& prompt,
        const std::vector<std::string>& image_paths,
        StreamCallback callback,
        const GenerationConfig& config = {}
    );

    /**
     * Start a new chat session (clears KV-cache)
     */
    void start_chat();

    /**
     * Continue chat with message history
     */
    std::string chat(
        const std::vector<Message>& messages,
        const GenerationConfig& config = {}
    );

    /**
     * Get model info
     */
    struct ModelInfo {
        std::string name;
        std::string architecture;
        size_t vocab_size;
        size_t max_position_embeddings;
        size_t hidden_size;
        size_t num_attention_heads;
        size_t num_layers;
        bool supports_vision;
    };
    ModelInfo get_model_info() const;

    /**
     * Check if model is loaded
     */
    bool is_loaded() const;

    /**
     * Get device string
     */
    static std::string device_to_string(Device device);

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;

    // Format messages into prompt
    std::string format_prompt(const std::vector<Message>& messages) const;

    // Load image from path to tensor
    ov::Tensor load_image(const std::string& path) const;
};

/**
 * LLMEngine - Text-only language model (lighter weight)
 *
 * For tasks that don't need vision capabilities.
 */
class LLMEngine {
public:
    struct Config {
        std::string model_path;
        VLMEngine::Device device = VLMEngine::Device::CPU;
        bool use_cache = true;
    };

    explicit LLMEngine(const Config& config);
    ~LLMEngine();

    LLMEngine(LLMEngine&&) noexcept;
    LLMEngine& operator=(LLMEngine&&) noexcept;

    std::string generate(
        const std::string& prompt,
        const GenerationConfig& config = {}
    );

    void generate_stream(
        const std::string& prompt,
        StreamCallback callback,
        const GenerationConfig& config = {}
    );

    void start_chat();

    std::string chat(
        const std::vector<Message>& messages,
        const GenerationConfig& config = {}
    );

    bool is_loaded() const;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace simi
