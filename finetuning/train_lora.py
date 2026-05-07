"""Train a Qwen 2.5 7B LoRA adapter via PEFT+TRL on ROCm."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def main(*, data_path: Path, out_path: Path, base_model: str, epochs: int, lora_r: int) -> None:
    # Heavy deps — lazy import.
    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
    from trl import SFTConfig, SFTTrainer

    logging.basicConfig(level=logging.INFO)
    logger.info("loading dataset from %s", data_path)
    rows = []
    with data_path.open() as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    logger.info("loaded %d rows", len(rows))

    def to_chat(row):
        return {
            "messages": [
                {"role": "user", "content": row["prompt"]},
                {"role": "assistant", "content": row["response"]},
            ]
        }

    ds = Dataset.from_list([to_chat(r) for r in rows])

    logger.info("loading tokenizer + base model %s", base_model)
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    model.gradient_checkpointing_enable()

    lora_cfg = LoraConfig(
        r=lora_r,
        lora_alpha=2 * lora_r,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()

    cfg = SFTConfig(
        output_dir=str(out_path),
        num_train_epochs=epochs,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_ratio=0.05,
        learning_rate=2e-4,
        bf16=True,
        logging_steps=5,
        save_strategy="epoch",
        save_total_limit=1,
        report_to="none",
        packing=False,
    )

    trainer = SFTTrainer(
        model=model,
        args=cfg,
        train_dataset=ds,
        processing_class=tokenizer,
    )
    trainer.train()

    logger.info("saving adapter to %s", out_path)
    out_path.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(out_path))
    tokenizer.save_pretrained(str(out_path))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=Path("/data/train/chaos_lora.jsonl"))
    p.add_argument("--out", type=Path, default=Path("/data/lora_adapters/chaos_v1"))
    p.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--r", type=int, default=8)
    args = p.parse_args()

    main(
        data_path=args.data,
        out_path=args.out,
        base_model=args.base_model,
        epochs=args.epochs,
        lora_r=args.r,
    )
