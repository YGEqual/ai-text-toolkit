# AI 率检测 · 本地模型增强服务

用开源 RoBERTa 中文检测器为前端提供更准的 AI 率检测。前端不连服务时仍可用内置启发式算法（离线兜底）；启动本服务并在页面勾选"本地模型增强"后，检测改用模型。

- **模型**：[`Hello-SimpleAI/chatgpt-detector-roberta-chinese`](https://huggingface.co/Hello-SimpleAI/chatgpt-detector-roberta-chinese)（基于 `hfl/chinese-roberta-wwm-ext`，HC3-Chinese 训练）
- **标签**：`0=Human, 1=ChatGPT`，输出索引 1 的概率作为 AI 率
- **英文场景**：把环境变量 `DETECTOR_MODEL` 设为 `Hello-SimpleAI/chatgpt-detector-roberta` 即可

## 安装与启动

建议用虚拟环境：

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # 仅用 CPU 可装 CPU 版 torch，体积更小
uvicorn app:app --host 127.0.0.1 --port 8000
```

> 首次启动自动从 HuggingFace 下载模型权重（约 400MB），之后离线缓存到 `~/.cache/huggingface`。
> 如需国内加速，启动前设置 `export HF_ENDPOINT=https://hf-mirror.com`。
> 纯 CPU 安装更省体积：`pip install torch --index-url https://download.pytorch.org/whl/cpu`

## 接口

- `GET /health` → `{status, model, device, id2label}`
- `POST /detect`，body `{"text": "..."}` → `{ai_prob, score, chunks, chunk_probs, model}`

长文本会按句子边界自动切块（≤480 字/块，模型上限 512 token），按长度加权平均得到整体 AI 率。

## 资源占用

- 模型 ~102M 参数，CPU 即可运行（无需显卡），常驻内存约 0.5–1GB
- 单段文本推理：CPU 上约几十~几百毫秒（取决于长度与机器）

## 在页面中使用

1. 启动本服务（默认 `http://127.0.0.1:8000`）
2. 打开 `../index.html`，在「AI 率检测」勾选 **本地模型增强**
3. 若服务地址不同，在输入框旁修改 endpoint
4. 服务不可达时会自动回退到内置启发式算法并给出提示
