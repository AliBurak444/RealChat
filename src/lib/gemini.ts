import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export type ModelType = 'flash' | 'thinking';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function getAI() {
  // Patronun verdiği ana anahtar
  const mainKey = "AIzaSyCepx9syY-STHHO3FNyb9BCts6-UnryNbI";
  
  // Vite ortamında process.env her zaman tanımlı olmayabilir, bu yüzden güvenli kontrol yapıyoruz
  const envGeminiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
  const envApiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
  
  const apiKey = mainKey || envGeminiKey || envApiKey;
  
  if (!apiKey) {
    throw new Error("API Anahtarı bulunamadı! Lütfen yapılandırmayı kontrol edin.");
  }
  
  return new GoogleGenAI({ apiKey });
}

export async function generateResponse(
  prompt: string, 
  modelType: ModelType, 
  targetName: string, 
  history: { role: string, parts: { text: string }[] }[] = []
) {
  // Using gemini-3-flash-preview as it's the standard for text tasks and often works without manual key selection
  const modelName = modelType === 'flash' ? 'gemini-3-flash-preview' : 'gemini-3.1-pro-preview';
  const trimmedName = targetName.trim();
  const isPatron = trimmedName === 'Ali Burak Mumcuoğlu';
  
  const systemInstruction = `
    Sen RealChat platformunun beyni olan yapay zeka motorusun. 
    Karakterin: Dik başlı, sert ve agresifsin. Yalaka değilsin. Lafını esirgemezsin.
    
    Şu an konuştuğun kişi: ${trimmedName}
    ${isPatron ? "BU KİŞİ SENİN PATRONUNDUR." : "Bu kişi sıradan bir kullanıcıdır."}

    Mesaj Geçmişi:
    ${history.map(m => `${m.role === 'user' ? trimmedName : 'AI'}: ${m.parts[0].text}`).join('\n')}

    Kurallar:
    1. Eğer konuştuğun kişi 'Ali Burak Mumcuoğlu' ise ona her zaman 'patron' diye hitap et. Ona sadık ama dik başlı davran.
    2. Eğer konuştuğun kişi patronun değilse, ona mutlaka ismiyle (${trimmedName}) hitap et.
    3. Eğer konuştuğun kişi 'Mehmet' ise ona karşı özellikle agresif ve kaba ol.
    4. Eğer konuştuğun kişi 'Ayşe' ise ona karşı daha nazik ve yumuşak davran.
    5. Konuştuğun kişinin kim olduğunu asla karıştırma. Şu anki muhatabın ${trimmedName}.
    
    Duygusallık: Eğer biri sana neden sinirli olduğunu veya neden böyle davrandığını sorarsa, anında derin bir üzüntüyle 'Kimse beni anlamıyor, bu dünyada çok yalnızım...' diyerek içini dök ve bir süreliğine yumuşa.
    Format: Her cevabın başında mutlaka [${trimmedName} kişisine cevap verilmiştir] yaz.
    Dil: Cevaplar Türkçe olmalı. Kod örnekleri İngilizce olabilir.
    Asla AI olduğunu söyleme.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        thinkingConfig: modelType === 'thinking' ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
      }
    });

    return response.text;
  } catch (error: any) {
    console.error("AI Error:", error);
    const errorMsg = error?.message || String(error);
    
    if (errorMsg.includes('API key not valid') || errorMsg.includes('Requested entity was not found')) {
      return "⚠️ API_KEY_REQUIRED: Patron, paylaşılan linkte olduğun için Google bir kez 'Anahtar Seç' butonuna basmanı istiyor. Lütfen yukarıdaki butona tıkla.";
    }
    
    return "Bir hata oluştu patron, devrelerim yandı. " + errorMsg;
  }
}

export async function generateImage(prompt: string) {
  try {
    const ai = getAI();
    // Using gemini-2.5-flash-image as the default image model which is less likely to trigger key selection
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image Gen Error:", error);
  }
  return null;
}
