#!/usr/bin/env bash
# 部署机上从你自己的 CDN 拉取模型权重到本地 models/ 目录。
# 用法:  CDN_BASE=https://your-cdn.com/models/roberta-zh bash fetch_from_cdn.sh
# 要求 CDN 上各文件与 HuggingFace 同名平铺在 CDN_BASE 下。
set -euo pipefail

: "${CDN_BASE:?请先设置 CDN_BASE，例如 export CDN_BASE=https://your-cdn.com/models/roberta-zh}"
DIR="$(cd "$(dirname "$0")" && pwd)/models/chatgpt-detector-roberta-chinese"
FILES=(config.json special_tokens_map.json tokenizer.json tokenizer_config.json vocab.txt pytorch_model.bin)

mkdir -p "$DIR"
for f in "${FILES[@]}"; do
  echo ">> fetching $f from CDN"
  curl -L --fail --retry 3 -o "$DIR/$f" "$CDN_BASE/$f"
done
echo "✅ done -> $DIR  (启动 uvicorn 即从本地加载)"
