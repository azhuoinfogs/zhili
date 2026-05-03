"""
读取 prototype/server/data/events.jsonl，按 plan0 计算 CTR 与卡方检验。
用法：在仓库根或 prototype 目录执行
  pip install -r analysis/requirements.txt
  python analysis/analyze_events.py path/to/events.jsonl
默认路径：../server/data/events.jsonl（相对 analysis 目录）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from scipy.stats import chi2_contingency


def load_jsonl(path: Path) -> pd.DataFrame:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return pd.DataFrame(rows)


def main() -> None:
    base = Path(__file__).resolve().parent
    default = base.parent / "server" / "data" / "events.jsonl"
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    if not path.exists():
        print(f"未找到文件: {path}")
        sys.exit(1)

    df = load_jsonl(path)
    if df.empty:
        print("无事件数据")
        sys.exit(0)

    need = {"event", "user_id", "group"}
    missing = need - set(df.columns)
    if missing:
        print("缺少列:", missing)
        sys.exit(1)

    form_users = set(df.loc[df["event"] == "form_submit", "user_id"])
    imp_counts = df.loc[df["event"] == "impression"].groupby("user_id").size()
    valid_users = [u for u in form_users if imp_counts.get(u, 0) >= 10]
    df_v = df[df["user_id"].isin(valid_users)].copy()
    print(f"有效用户(画像+曝光≥10): {len(valid_users)}")

    imp = df_v[df_v["event"] == "impression"]
    clk = df_v[df_v["event"] == "click"]
    pur = df_v[df_v["event"] == "purchase_click"]

    imp_g = imp.groupby("group").size()
    clk_g = clk.groupby("group").size()
    pur_g = pur.groupby("group").size()

    print("\n按组曝光 / 点击 / 购买点击:")
    for g in sorted(imp_g.index.astype(str).unique()):
        i = int(imp_g.get(g, 0))
        c = int(clk_g.get(g, 0))
        p = int(pur_g.get(g, 0))
        ctr = (c / i) if i else 0
        cvr_proxy = (p / c) if c else 0
        print(f"  {g}: imp={i}, click={c}, purchase_click={p}, CTR={ctr:.4f}, purchase/click={cvr_proxy:.4f}")

    groups = [x for x in ("A", "B") if x in imp_g.index or x in clk_g.index]
    if len(groups) >= 2:
        a, b = "A", "B"
        a_imp, a_clk = int(imp_g.get(a, 0)), int(clk_g.get(a, 0))
        b_imp, b_clk = int(imp_g.get(b, 0)), int(clk_g.get(b, 0))
        table = [[a_clk, a_imp - a_clk], [b_clk, b_imp - b_clk]]
        chi2, p, dof, expected = chi2_contingency(table)
        print(f"\nCTR 卡方检验: chi2={chi2:.4f}, p={p:.4f}")
        if p < 0.05:
            print("p<0.05：两组点击率差异具有统计显著性（需结合业务解读方向）")
        else:
            print("p>=0.05：未达常规显著性阈值")

    print("\n完成。可将本输出粘贴进实验报告。")


if __name__ == "__main__":
    main()
