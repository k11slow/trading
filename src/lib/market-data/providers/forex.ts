import { MockProvider } from "./mock";
import { TwelveDataForexProvider } from "./twelve-data";
export const forexProvider = process.env.TWELVE_DATA_API_KEY ? new TwelveDataForexProvider() : new MockProvider(["Forex"], "Mock Forex");
