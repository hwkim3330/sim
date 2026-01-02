#include "simi/vlm_engine.hpp"
#include <openvino/openvino.hpp>
#include <openvino/genai/visual_language/pipeline.hpp>
#include <fstream>
#include <sstream>
#include <iostream>
#include <filesystem>

namespace fs = std::filesystem;

namespace simi {

// ============================================================================
// VLMEngine Implementation
// ============================================================================

struct VLMEngine::Impl {
    std::unique_ptr<ov::genai::VLMPipeline> pipeline;
    Config config;
    bool loaded = false;
    ModelInfo info;

    // Image cache
    std::map<std::string, ov::Tensor> image_cache;
};

VLMEngine::VLMEngine(const Config& config)
    : impl_(std::make_unique<Impl>())
{
    impl_->config = config;

    if (!fs::exists(config.model_path)) {
        throw std::runtime_error("Model path does not exist: " + config.model_path);
    }

    try {
        std::string device_str = device_to_string(config.device);

        // Create pipeline
        impl_->pipeline = std::make_unique<ov::genai::VLMPipeline>(
            config.model_path,
            device_str
        );

        impl_->loaded = true;

        // Get model info (basic for now)
        impl_->info.name = "Qwen2.5-VL";
        impl_->info.supports_vision = true;

    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to load VLM model: " + std::string(e.what()));
    }
}

VLMEngine::~VLMEngine() = default;

VLMEngine::VLMEngine(VLMEngine&&) noexcept = default;
VLMEngine& VLMEngine::operator=(VLMEngine&&) noexcept = default;

std::string VLMEngine::device_to_string(Device device) {
    switch (device) {
        case Device::CPU: return "CPU";
        case Device::GPU: return "GPU";
        case Device::NPU: return "NPU";
        case Device::AUTO: return "AUTO";
        default: return "CPU";
    }
}

std::string VLMEngine::generate(
    const std::string& prompt,
    const GenerationConfig& config
) {
    return generate(prompt, {}, config);
}

std::string VLMEngine::generate(
    const std::string& prompt,
    const std::vector<std::string>& image_paths,
    const GenerationConfig& config
) {
    if (!impl_->loaded) {
        throw std::runtime_error("Model not loaded");
    }

    try {
        // Load images
        std::vector<ov::Tensor> images;
        for (const auto& path : image_paths) {
            images.push_back(load_image(path));
        }

        // Create generation config
        ov::genai::GenerationConfig gen_config;
        gen_config.max_new_tokens = config.max_new_tokens;
        gen_config.temperature = config.temperature;
        gen_config.top_p = config.top_p;
        gen_config.top_k = config.top_k;
        gen_config.do_sample = config.do_sample;

        // Generate
        std::string result;
        if (images.empty()) {
            result = impl_->pipeline->generate(prompt, gen_config);
        } else {
            ov::AnyMap params;
            params["images"] = images;
            params["max_new_tokens"] = config.max_new_tokens;
            result = impl_->pipeline->generate(prompt, params);
        }

        return result;

    } catch (const std::exception& e) {
        throw std::runtime_error("Generation failed: " + std::string(e.what()));
    }
}

void VLMEngine::generate_stream(
    const std::string& prompt,
    const std::vector<std::string>& image_paths,
    StreamCallback callback,
    const GenerationConfig& config
) {
    if (!impl_->loaded) {
        throw std::runtime_error("Model not loaded");
    }

    try {
        // Load images
        std::vector<ov::Tensor> images;
        for (const auto& path : image_paths) {
            images.push_back(load_image(path));
        }

        // Streaming callback wrapper
        auto streamer = [&callback](const std::string& token) -> bool {
            if (callback) {
                callback(token);
            }
            return false;  // Continue generation
        };

        // Generate with streaming
        ov::AnyMap params;
        if (!images.empty()) {
            params["images"] = images;
        }
        params["max_new_tokens"] = config.max_new_tokens;

        impl_->pipeline->generate(prompt, params, streamer);

    } catch (const std::exception& e) {
        throw std::runtime_error("Streaming generation failed: " + std::string(e.what()));
    }
}

void VLMEngine::start_chat() {
    if (impl_->pipeline) {
        impl_->pipeline->start_chat();
    }
}

std::string VLMEngine::chat(
    const std::vector<Message>& messages,
    const GenerationConfig& config
) {
    std::string prompt = format_prompt(messages);

    // Collect all images from messages
    std::vector<std::string> all_images;
    for (const auto& msg : messages) {
        for (const auto& img : msg.images) {
            all_images.push_back(img);
        }
    }

    return generate(prompt, all_images, config);
}

std::string VLMEngine::format_prompt(const std::vector<Message>& messages) const {
    // Qwen2-VL chat format
    std::ostringstream oss;

    for (const auto& msg : messages) {
        switch (msg.role) {
            case Role::System:
                oss << "<|im_start|>system\n" << msg.content << "<|im_end|>\n";
                break;
            case Role::User:
                oss << "<|im_start|>user\n";
                // Add image placeholders
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
        }
    }

    // Add assistant start for generation
    oss << "<|im_start|>assistant\n";

    return oss.str();
}

ov::Tensor VLMEngine::load_image(const std::string& path) const {
    // Check cache
    auto it = impl_->image_cache.find(path);
    if (it != impl_->image_cache.end()) {
        return it->second;
    }

    // Read file
    if (!fs::exists(path)) {
        throw std::runtime_error("Image file not found: " + path);
    }

    std::ifstream file(path, std::ios::binary);
    if (!file) {
        throw std::runtime_error("Failed to open image: " + path);
    }

    std::vector<uint8_t> data(
        (std::istreambuf_iterator<char>(file)),
        std::istreambuf_iterator<char>()
    );

    // Create tensor from raw image data
    // OpenVINO GenAI handles image decoding internally
    ov::Tensor tensor(ov::element::u8, {1, data.size()}, data.data());

    return tensor;
}

VLMEngine::ModelInfo VLMEngine::get_model_info() const {
    return impl_->info;
}

bool VLMEngine::is_loaded() const {
    return impl_->loaded;
}

// ============================================================================
// LLMEngine Implementation
// ============================================================================

struct LLMEngine::Impl {
    std::unique_ptr<ov::genai::LLMPipeline> pipeline;
    Config config;
    bool loaded = false;
};

LLMEngine::LLMEngine(const Config& config)
    : impl_(std::make_unique<Impl>())
{
    impl_->config = config;

    if (!fs::exists(config.model_path)) {
        throw std::runtime_error("Model path does not exist: " + config.model_path);
    }

    try {
        std::string device_str = VLMEngine::device_to_string(config.device);

        impl_->pipeline = std::make_unique<ov::genai::LLMPipeline>(
            config.model_path,
            device_str
        );

        impl_->loaded = true;

    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to load LLM model: " + std::string(e.what()));
    }
}

LLMEngine::~LLMEngine() = default;

LLMEngine::LLMEngine(LLMEngine&&) noexcept = default;
LLMEngine& LLMEngine::operator=(LLMEngine&&) noexcept = default;

std::string LLMEngine::generate(
    const std::string& prompt,
    const GenerationConfig& config
) {
    if (!impl_->loaded) {
        throw std::runtime_error("Model not loaded");
    }

    ov::genai::GenerationConfig gen_config;
    gen_config.max_new_tokens = config.max_new_tokens;
    gen_config.temperature = config.temperature;
    gen_config.do_sample = config.do_sample;

    return impl_->pipeline->generate(prompt, gen_config);
}

void LLMEngine::generate_stream(
    const std::string& prompt,
    StreamCallback callback,
    const GenerationConfig& config
) {
    if (!impl_->loaded) {
        throw std::runtime_error("Model not loaded");
    }

    auto streamer = [&callback](const std::string& token) -> bool {
        if (callback) {
            callback(token);
        }
        return false;
    };

    ov::genai::GenerationConfig gen_config;
    gen_config.max_new_tokens = config.max_new_tokens;

    impl_->pipeline->generate(prompt, gen_config, streamer);
}

void LLMEngine::start_chat() {
    if (impl_->pipeline) {
        impl_->pipeline->start_chat();
    }
}

std::string LLMEngine::chat(
    const std::vector<Message>& messages,
    const GenerationConfig& config
) {
    std::ostringstream oss;

    for (const auto& msg : messages) {
        switch (msg.role) {
            case Role::System:
                oss << "<|im_start|>system\n" << msg.content << "<|im_end|>\n";
                break;
            case Role::User:
                oss << "<|im_start|>user\n" << msg.content << "<|im_end|>\n";
                break;
            case Role::Assistant:
                oss << "<|im_start|>assistant\n" << msg.content << "<|im_end|>\n";
                break;
            case Role::Tool:
                oss << "<|im_start|>tool\n" << msg.content << "<|im_end|>\n";
                break;
        }
    }
    oss << "<|im_start|>assistant\n";

    return generate(oss.str(), config);
}

bool LLMEngine::is_loaded() const {
    return impl_->loaded;
}

} // namespace simi
