/**
 * DataForge Marketplace API — paid data endpoints served via x402 protocol.
 * Run before the x402 agent: npm run x402:server
 */

import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  paymentMiddleware(
    (process.env.PAYMENT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    {
      "/api/market/trends":       { price: "$0.005", network: "base-sepolia" },
      "/api/company/profile":     { price: "$0.003", network: "base-sepolia" },
      "/api/news/feed":           { price: "$0.002", network: "base-sepolia" },
      "/api/competitor/analysis": { price: "$0.008", network: "base-sepolia" },
      "/api/finance/metrics":     { price: "$0.005", network: "base-sepolia" },
    },
    { url: "https://x402.org/facilitator" }
  )
);

app.get("/api/market/trends", (_req, res) => {
  res.json({
    product: "Market Trends Analysis",
    sector: "AI Infrastructure",
    date: new Date().toISOString().split("T")[0],
    trends: [
      { trend: "Inference cost commoditization", momentum: "high", yoy_growth: "340%" },
      { trend: "On-device AI (edge inference)", momentum: "high", yoy_growth: "210%" },
      { trend: "Multimodal model adoption", momentum: "medium", yoy_growth: "180%" },
      { trend: "AI agent infrastructure", momentum: "explosive", yoy_growth: "520%" },
      { trend: "Retrieval-Augmented Generation (RAG)", momentum: "medium", yoy_growth: "145%" },
    ],
    key_insight: "Agent infrastructure is the fastest-growing subsector, driven by enterprise automation demand.",
  });
});

app.get("/api/company/profile", (req, res) => {
  const q = (req.query.q as string) || "OpenAI";
  res.json({
    product: "Company Intelligence Report",
    company: q,
    founded: 2015,
    valuation: "$157B",
    headcount: 3200,
    revenue_2025: "$3.7B ARR",
    growth_rate: "200% YoY",
    key_products: ["ChatGPT", "GPT-4o", "o3", "Sora", "API Platform"],
    moat: "Brand, data flywheel, enterprise relationships, safety credibility",
    risks: ["Compute costs", "Regulatory pressure", "Talent competition"],
  });
});

app.get("/api/news/feed", (req, res) => {
  const q = (req.query.q as string) || "AI";
  res.json({
    product: "Live News Feed",
    topic: q,
    articles: [
      {
        title: "AI Infrastructure Spending to Hit $200B in 2026",
        source: "TechCrunch",
        sentiment: "bullish",
        summary: "Hyperscalers are accelerating capex on GPU clusters, with Microsoft and Google leading.",
      },
      {
        title: "Anthropic Releases Claude 4 with Extended Context",
        source: "The Verge",
        sentiment: "neutral",
        summary: "New model supports 1M token context, targeting enterprise document workflows.",
      },
      {
        title: "EU AI Act Enforcement Begins, Fines Issued",
        source: "Reuters",
        sentiment: "cautious",
        summary: "First penalties under the AI Act target high-risk system deployments without audits.",
      },
    ],
  });
});

app.get("/api/competitor/analysis", (_req, res) => {
  res.json({
    product: "Competitor Benchmarking Report",
    segment: "AI API Platforms",
    competitors: [
      { name: "OpenAI API",    market_share: "42%", pricing: "$$$$", strengths: ["Brand", "GPT-4o quality"], weaknesses: ["Cost", "Latency"] },
      { name: "Anthropic API", market_share: "28%", pricing: "$$$",  strengths: ["Safety", "Long context", "Coding"], weaknesses: ["Ecosystem"] },
      { name: "Google Vertex", market_share: "18%", pricing: "$$",   strengths: ["Enterprise", "Multimodal"], weaknesses: ["DX complexity"] },
      { name: "Groq",          market_share: "7%",  pricing: "$",    strengths: ["Speed", "Price"], weaknesses: ["Model selection"] },
      { name: "Together AI",   market_share: "5%",  pricing: "$",    strengths: ["OSS models", "Fine-tuning"], weaknesses: ["Support"] },
    ],
    recommendation: "Focus on mid-market enterprises where Anthropic's safety story and long context win over OpenAI's brand premium.",
  });
});

app.get("/api/finance/metrics", (_req, res) => {
  res.json({
    product: "Financial KPIs & VC Metrics",
    sector: "AI SaaS",
    metrics: [
      { kpi: "Net Revenue Retention", benchmark: "130%+", top_quartile: "160%", meaning: "Expansion > churn" },
      { kpi: "Gross Margin",          benchmark: "75%+",  top_quartile: "85%",  meaning: "Software-like margins" },
      { kpi: "Payback Period",        benchmark: "<18mo", top_quartile: "<9mo", meaning: "CAC recovery speed" },
      { kpi: "ARR Growth",            benchmark: "100%+", top_quartile: "200%", meaning: "Series A/B threshold" },
      { kpi: "Magic Number",          benchmark: ">0.75", top_quartile: ">1.0", meaning: "Sales efficiency" },
    ],
    vc_focus_2026: "VCs are now prioritizing NRR and gross margin over pure ARR growth as the market matures.",
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok", marketplace: "DataForge" }));

app.listen(PORT, () => {
  console.log(`[dataforge-marketplace] running on http://localhost:${PORT}`);
  console.log(`Paid endpoints: /api/market/trends, /api/company/profile, /api/news/feed, /api/competitor/analysis, /api/finance/metrics`);
});
