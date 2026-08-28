"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RuleBasedSetup } from "@/lib/ai";
import {
  canEmitBuyAlert, createBuyAlert, defaultBuyAlertSettings,
  evaluateBuyAlert, frequencySettings,
  type AlertFrequency, type BuyAlertRecord, type BuyAlertSettings,
} from "@/lib/alerts/buy-alert-engine";

const SETTINGS_KEY = "ai-buy-alert-settings-v1";
const HISTORY_KEY = "ai-buy-alert-history-v1";
export function useBuyAlerts(facts: RuleBasedSetup | null) {
  const [settings, setSettings] = useState(defaultBuyAlertSettings);
  const [history, setHistory] = useState<BuyAlertRecord[]>([]);
  const [toast, setToast] = useState<BuyAlertRecord | null>(null);
  const hydrated = useRef(false);
  useEffect(() => {
    let savedSettings = defaultBuyAlertSettings;
    let savedHistory: BuyAlertRecord[] = [];
    try {
      savedSettings = { ...savedSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
      savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]").slice(0, 200);
    } catch { /* Invalid local alert state is replaced with defaults. */ }
    const frame = requestAnimationFrame(() => {
      setSettings(savedSettings); setHistory(savedHistory); hydrated.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (hydrated.current) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { if (hydrated.current) localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);
  useEffect(() => {
    if (!hydrated.current || !facts) return;
    const active = history.find((item) => item.symbol === facts.symbol && (item.status === "Triggered" || item.status === "Viewed"));
    if (active && (facts.preference !== "BUY" || !facts.confirmation15M.confirmed)) {
      const frame = requestAnimationFrame(() =>
        setHistory((current) => current.map((item) => item.id === active.id ? { ...item, status: "Invalidated" } : item)),
      );
      return () => cancelAnimationFrame(frame);
    }
    const decision = evaluateBuyAlert(facts, settings);
    if (!decision.trigger || !canEmitBuyAlert(facts, active, settings, Date.now())) return;
    const alert = createBuyAlert(facts);
    const frame = requestAnimationFrame(() => {
      setHistory((current) => [alert, ...current].slice(0, 200));
      setToast(alert);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notification = new Notification(`AI BUY SETUP — ${alert.symbol}`, {
          body: `${alert.quality} • Buy ${alert.buyScore} • R:R 1:${alert.riskReward.toFixed(2)}\nTrading setup alert — not guaranteed profit.`,
          tag: `buy:${alert.symbol}`,
        });
        notification.onclick = () => { window.focus(); notification.close(); };
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [facts, history, settings]);
  const updateSettings = useCallback((next: Partial<BuyAlertSettings>) => setSettings((current) => ({ ...current, ...next })), []);
  const setFrequency = useCallback((frequency: AlertFrequency) => updateSettings(frequencySettings(frequency)), [updateSettings]);
  const setEnabled = useCallback(async (enabled: boolean) => {
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
    updateSettings({ enabled });
  }, [updateSettings]);
  const viewAlert = useCallback((id: string) => { setHistory((current) => current.map((item) => item.id === id ? { ...item, status: "Viewed" } : item)); setToast(null); }, []);
  return { settings, history, toast, updateSettings, setFrequency, setEnabled, viewAlert, dismissToast: () => setToast(null) };
}
