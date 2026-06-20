"""
本地 AI 文本检测服务 —— RoBERTa 中文检测器增强档
模型: Hello-SimpleAI/chatgpt-detector-roberta-chinese (基于 hfl/chinese-roberta-wwm-ext, HC3-Chinese)
标签: 0=Human, 1=ChatGPT  ->  AI 概率取索引 1

启动:
    pip install -r requirements.txt
    uvicorn app:app --host 127.0.0.1 --port 8000
首次启动会自动下载模型权重(约 400MB)，之后离线缓存。
"""
import os
import re
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# 模型来源优先级：环境变量 DETECTOR_MODEL > 本地 models/ 目录 > HuggingFace 在线名称
# 把模型放自己的 CDN 时：部署机先跑 fetch_from_cdn.sh 拉到本地目录，本服务即从本地加载。
_LOCAL_DIR = os.path.join(os.path.dirname(__file__), "models", "chatgpt-detector-roberta-chinese")
_DEFAULT = _LOCAL_DIR if os.path.exists(os.path.join(_LOCAL_DIR, "config.json")) \
    else "Hello-SimpleAI/chatgpt-detector-roberta-chinese"
MODEL_NAME = os.environ.get("DETECTOR_MODEL", _DEFAULT)
MAX_TOKENS = 512
MAX_CHARS_PER_CHUNK = 480  # 给特殊 token 留余量

print(f"[init] loading model: {MODEL_NAME} ...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.eval()
device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)
ID2LABEL = {int(k): v for k, v in model.config.id2label.items()}

def _ai_index() -> int:
    """找出代表 AI/ChatGPT 的类别索引，找不到则默认最后一类。"""
    for i, lab in ID2LABEL.items():
        if re.search(r"chatgpt|gpt|\bai\b|fake|machine|generated", str(lab), re.I):
            return i
    return max(ID2LABEL.keys())

AI_IDX = _ai_index()
print(f"[init] id2label={ID2LABEL}  ai_index={AI_IDX}  device={device}")


def split_chunks(text: str):
    """按句子边界把长文本切成 <=MAX_CHARS_PER_CHUNK 的块，超长单句再硬切。"""
    sents = re.split(r"(?<=[。！？!?；;\n])", text)
    chunks, cur = [], ""
    for s in sents:
        if not s:
            continue
        if len(s) > MAX_CHARS_PER_CHUNK:
            if cur:
                chunks.append(cur); cur = ""
            for i in range(0, len(s), MAX_CHARS_PER_CHUNK):
                chunks.append(s[i:i + MAX_CHARS_PER_CHUNK])
        elif len(cur) + len(s) > MAX_CHARS_PER_CHUNK and cur:
            chunks.append(cur); cur = s
        else:
            cur += s
    if cur.strip():
        chunks.append(cur)
    return chunks or [text]


@torch.no_grad()
def infer(text: str):
    chunks = split_chunks(text)
    probs = []
    for c in chunks:
        enc = tokenizer(c, return_tensors="pt", truncation=True, max_length=MAX_TOKENS).to(device)
        logits = model(**enc).logits
        p = torch.softmax(logits, dim=-1)[0]
        probs.append(float(p[AI_IDX]))
    # 长度加权平均，长块权重更高
    weights = [len(c) for c in chunks]
    total_w = sum(weights) or 1
    ai_prob = sum(p * w for p, w in zip(probs, weights)) / total_w
    return ai_prob, probs


app = FastAPI(title="AI Text Detector (RoBERTa-Chinese)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False,
)


class DetectReq(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "device": device, "id2label": ID2LABEL}


@app.post("/detect")
def detect(req: DetectReq):
    text = (req.text or "").strip()
    if not text:
        return {"error": "empty text"}
    ai_prob, chunk_probs = infer(text)
    return {
        "ai_prob": ai_prob,                 # 0..1
        "score": round(ai_prob * 100),      # 0..100
        "chunks": len(chunk_probs),
        "chunk_probs": [round(p, 4) for p in chunk_probs],
        "model": MODEL_NAME,
    }
