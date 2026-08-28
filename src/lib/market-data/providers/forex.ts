import { MockProvider } from "./mock";
import { OandaForexProvider } from "./oanda";
import { TwelveDataForexProvider } from "./twelve-data";
export const forexProvider = process.env.OANDA_API_TOKEN && process.env.OANDA_ACCOUNT_ID
  ? new OandaForexProvider()
  : process.env.TWELVE_DATA_API_KEY
    ? new TwelveDataForexProvider()
    : new MockProvider(["Forex"], "Mock Forex");
