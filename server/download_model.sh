#!/usr/bin/env bash
# 从 HuggingFace(或镜像) 下载模型到本地 models/ 目录。
# 用法:  bash download_model.sh
# 国内加速:  HF_BASE=https://hf-mirror.com bash download_model.sh   (默认即用镜像)
set -euo pipefail

HF_BASE="${HF_BASE:-https://hf-mirror.com}"
REPO="Hello-SimpleAI/chatgpt-detector-roberta-chinese"
BASE="$HF_BASE/$REPO/resolve/main"
DIR="$(cd "$(dirname "$0")" && pwd)/models/chatgpt-detector-roberta-chinese"
FILES=(config.json special_tokens_map.json tokenizer.json tokenizer_config.json vocab.txt pytorch_model.bin)

mkdir -p "$DIR"
for f in "${FILES[@]}"; do
  echo ">> downloading $f"
  curl -L --fail --retry 3 -o "$DIR/$f" "$BASE/$f"
done
echo "✅ done -> $DIR"
echo "可把该目录下全部文件上传到你的 CDN，再用 fetch_from_cdn.sh 在部署机拉取。"
