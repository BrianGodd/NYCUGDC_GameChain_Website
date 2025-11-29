import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  //const apiKey = process.env.API_KEY;
  const apiKey = "AIzaSyDDk-sng9QtBO5Dq5TEJXkTzGcirOoLoAI";

  if (!apiKey) {
    console.error("API Key missing");
    throw new Error("API Key is missing from environment");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTrendCards = async (roundTitle: string): Promise<string[]> => {
  try {
    const ai = getClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `我們正在製作遊戲，請幫我們生成兩個有趣的"${roundTitle}"，需與最新時勢、潮流、或梗有關。每個"${roundTitle}"用1~3個單詞表達即可，例如:醜陋的哥布林。僅回傳 JSON 即可。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const text = response.text;
    if (!text) return ["Cyberpunk Cat", "Roguelike Farming"]; // Fallback
    
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length >= 2) {
      return data.slice(0, 2);
    }
    return ["AI Glitch", "Neural Network"];
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails (e.g., quota or key issues)
    return ["Space Mining", "Time Loop"];
  }
};

export const generateSingleCardInput = async (roundTitle: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `我們正在製作遊戲，請幫我們生成一個有趣的"${roundTitle}"。用1~3個單詞表達並僅回傳這樣就好。例如:醜陋的哥布林`,
    });
    return response.text?.trim() || "AI Creativity";
  } catch (error) {
    console.error("Gemini Single Gen Error:", error);
    return "System Error";
  }
};

export const generateThemeImage = async (theme: string): Promise<string | null> => {
  try {
    const ai = getClient();
    // Using gemini-2.5-flash-image for standard image generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `主題為"${theme}"，幫我生成一張漫畫風格的搞笑圖片。僅回傳圖片。`,
          },
        ],
      },
      config: {
        // No responseMimeType for image models usually, but we need to parse parts
      },
    });
    console.log(response);
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          // Assuming PNG based on typical output, but checking mimeType is safer if provided
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64EncodeString}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    return null;
  }
};