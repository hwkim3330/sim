#!/usr/bin/env python3
"""
Simi Agent - Model Download Script

Downloads and converts Qwen2.5-VL-3B-Instruct to OpenVINO format.

Usage:
    python download_model.py [--model MODEL_NAME] [--output OUTPUT_DIR] [--device DEVICE]

Requirements:
    pip install optimum[openvino] transformers torch
"""

import argparse
import subprocess
import sys
from pathlib import Path


# Available models with their configurations
MODELS = {
    "qwen2.5-vl-3b": {
        "hf_id": "Qwen/Qwen2.5-VL-3B-Instruct",
        "output_dir": "qwen2.5-vl-3b-instruct",
        "weight_format": "int4",
        "description": "Qwen2.5-VL 3B - Balanced performance (Recommended)"
    },
    "qwen2.5-vl-7b": {
        "hf_id": "Qwen/Qwen2.5-VL-7B-Instruct",
        "output_dir": "qwen2.5-vl-7b-instruct",
        "weight_format": "int4",
        "description": "Qwen2.5-VL 7B - Higher quality, more memory"
    },
    "phi-3.5-vision": {
        "hf_id": "microsoft/Phi-3.5-vision-instruct",
        "output_dir": "phi-3.5-vision-instruct",
        "weight_format": "int4",
        "description": "Phi-3.5 Vision - Microsoft's multimodal model"
    },
    "llava-1.5-7b": {
        "hf_id": "llava-hf/llava-1.5-7b-hf",
        "output_dir": "llava-1.5-7b",
        "weight_format": "int4",
        "description": "LLaVA 1.5 7B - Classic vision-language model"
    },
    "minicpm-v-2.6": {
        "hf_id": "openbmb/MiniCPM-V-2_6",
        "output_dir": "minicpm-v-2.6",
        "weight_format": "int4",
        "description": "MiniCPM-V 2.6 - Compact and efficient"
    }
}


def check_requirements():
    """Check if required packages are installed."""
    try:
        import optimum
        import transformers
        print("✓ Requirements satisfied")
        return True
    except ImportError as e:
        print(f"✗ Missing requirement: {e.name}")
        print("\nInstall with:")
        print("  pip install optimum[openvino] transformers torch")
        return False


def download_model(model_name: str, output_base: Path, weight_format: str = "int4"):
    """Download and convert model to OpenVINO format."""
    if model_name not in MODELS:
        print(f"Unknown model: {model_name}")
        print(f"Available models: {', '.join(MODELS.keys())}")
        return False

    config = MODELS[model_name]
    output_dir = output_base / config["output_dir"]

    if output_dir.exists():
        print(f"Model already exists at: {output_dir}")
        response = input("Overwrite? [y/N]: ")
        if response.lower() != 'y':
            return True

    print(f"\nDownloading: {config['description']}")
    print(f"Hugging Face ID: {config['hf_id']}")
    print(f"Output: {output_dir}")
    print(f"Weight format: {weight_format}")
    print()

    # Build optimum-cli command
    cmd = [
        sys.executable, "-m", "optimum.cli", "export", "openvino",
        "--model", config["hf_id"],
        "--weight-format", weight_format,
        "--trust-remote-code",
        str(output_dir)
    ]

    print(f"Running: {' '.join(cmd)}")
    print("-" * 60)

    try:
        result = subprocess.run(cmd, check=True)
        print("-" * 60)
        print(f"✓ Model downloaded successfully to: {output_dir}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Download failed with code: {e.returncode}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def list_models():
    """List available models."""
    print("\nAvailable models:")
    print("-" * 60)
    for name, config in MODELS.items():
        print(f"  {name:20} {config['description']}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Download VLM models for Simi Agent"
    )
    parser.add_argument(
        "--model", "-m",
        default="qwen2.5-vl-3b",
        help="Model to download (default: qwen2.5-vl-3b)"
    )
    parser.add_argument(
        "--output", "-o",
        default="models",
        help="Output directory (default: models)"
    )
    parser.add_argument(
        "--weight-format", "-w",
        choices=["fp32", "fp16", "int8", "int4"],
        default="int4",
        help="Weight quantization format (default: int4)"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available models"
    )

    args = parser.parse_args()

    if args.list:
        list_models()
        return 0

    print("=" * 60)
    print("  Simi Agent - Model Download")
    print("=" * 60)

    if not check_requirements():
        return 1

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    success = download_model(args.model, output_dir, args.weight_format)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
