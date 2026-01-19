---
lastUpdated: 2026-01-17
slug: vllm-serve
draft: false
---

:::note

所有实例中的 api-key 均已脱敏并更换为全新生成的 UUID。

原运行环境：8x A800 80GB

:::

## Qwen3-235B-A22B-Thinking-2507
```bash
vllm serve "/root/models/Qwen3-235B-A22B-Thinking-2507-FP8" \
    --served-model-name "Qwen3-235B-A22B-Thinking-2507" \
    --api-key 019bcac6-df80-73e1-9059-ad635dadbc5f \
    --host 0.0.0.0 \
    --port 8000 \
    --enable-auto-tool-choice \
    --tool-call-parser hermes \
    --max-model-len 524288 \
    --hf-overrides '{"rope_scaling": {"factor": 2.0, "original_max_position_embeddings": 262144, "rope_type": "yarn"}}' \
    --max-num-seqs 256 \
    --reasoning-parser deepseek_r1 \
    --tensor-parallel-size 8 \
    --enable-expert-parallel \
    --kv-offloading-size 640 \
    --kv-offloading-backend lmcache \
    --disable-hybrid-kv-cache-manager
```

## BAAI/bge-m3
```bash
vllm serve "BAAI/bge-m3" \
		--api-key 019bcac6-df80-73e1-9059-ad635dadbc5f \
    --host 0.0.0.0 \
    --port 8073 \
    --gpu-memory-utilization 0.01 \
    --disable-log-requests
```

## zed-industries/zeta
```bash
CUDA_VISIBLE_DEVICES=1,2,3,4 vllm serve "zed-industries/zeta" \
    --served-model-name zeta \
    --host 127.0.0.1 \
    --port 7001 \
    --enable-prefix-caching \
    --enable-chunked-prefill \
    --speculative-config '{"method": "ngram", "num_speculative_tokens": 8, "prompt_lookup_max": 4, "prompt_lookup_min": 2}' \
    --quantization="fp8" \
    --tensor-parallel-size 4
```

## vllm bench
```bash
OPENAI_API_KEY=019bcac6-df80-73e1-9059-ad635dadbc5f vllm bench serve \
    --model "/root/models/Qwen3-235B-A22B-Thinking-2507-FP8" \
    --host 127.0.0.1 \
    --port 8000 \
    --random-input-len 32 \
    --random-output-len 4  \
    --num-prompts  5
```

