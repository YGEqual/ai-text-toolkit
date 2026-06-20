# 文本 AI 工具箱（离线版）

一个**纯前端、纯本地、离线可用**的单页工具，集成三大功能。双击 `index.html` 即可在浏览器中使用，所有处理都在本地完成，**不上传任何数据、不联网**。

## 功能

### 1. AI 率检测
估算一段文案由 AI 生成的概率（中英文自动识别）。综合多个开源检测器的公开特征：
- **AI 套话密度** —— 命中"综上所述/赋能/delve into/it is important to note"等模板表达
- **句长突发性缺失（burstiness）** —— 人类句长起伏大，AI 偏均匀
- **连接词密度** —— AI 偏爱"然而/因此/moreover/furthermore"
- **结构整齐度** —— 排比、列表、句长接近

> 结果为启发式概率估计，仅供参考，不作绝对判定。

### 2. 去 AI 化
对 AI 生成文案做降痕处理（中英文），可逐项开关、分轻/中/强三档：
- 去除套话与过渡词
- 破折号口语化
- 拆分长句、制造句长起伏
- 同义词替换

> 实测样例：AI 率 61% 的中文文案，去 AI 化后降至 46%。

### 3. PDF 加页码
基于开源库 **pdf-lib**，浏览器本地给 PDF 添加页码：
- **位置**：下方居中 / 右下角 / 左下角，可多选并存
- **格式**：`1`、`1 / N`、`- 1 -`、`Page 1 of N`、`第 1 页`、`第 1 页 / 共 N 页`
- **顺序**：正序（1→N）/ 倒序（N→1）
- **范围与起始**：从第几页标到第几页、起始页码（设 0 可让封面不计）
- **样式**：字号、边距、颜色
- 中文格式（"第 X 页"）需在本地选择一个中文字体文件（`.ttf/.otf`），仍然离线

## 使用

直接用浏览器打开 `index.html`。无需安装、无需服务器、无需联网。

## 目录结构

```
ai-text-toolkit/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # UI 总控
│   ├── detector.js     # AI 率检测算法
│   ├── humanizer.js    # 去 AI 化规则引擎
│   ├── pdf-pager.js    # PDF 加页码（pdf-lib）
│   └── lib/            # 本地开源库（pdf-lib、fontkit）
└── README.md
```

## 可选增强（本地开源模型）

当前检测/去 AI 化基于轻量启发式算法，开箱即用、零下载。若需更强能力，可接入
[transformers.js](https://github.com/huggingface/transformers.js) 在浏览器本地加载
开源模型（如困惑度模型、中文 paraphrase 模型）。`detector.js` / `humanizer.js` 已封装为
独立模块，替换/叠加实现即可，不影响主流程与离线特性（模型权重首次需下载一次后缓存）。

## 第三方开源依赖
- [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT)
- [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) (MIT)
