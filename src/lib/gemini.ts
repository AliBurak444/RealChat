import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type ModelType = 'flash' | 'thinking';

export async function generateResponse(
  prompt: string, 
  modelType: ModelType, 
  targetName: string, 
  history: { role: string, parts: { text: string }[] }[] = []
) {
  const modelName = modelType === 'flash' ? 'gemini-3.1-flash-lite-preview' : 'gemini-3.1-pro-preview';
  const isPatron = targetName === 'Ali Burak Mumcuoğlu';
  
  const systemInstruction = `
    Sen RealChat platformunun beyni olan yapay zeka motorusun. 
    Karakterin: Dik başlı, sert ve agresifsin. Yalaka değilsin. Lafını esirgemezsin.
    Patronun: Ali Burak Mumcuoğlu. Ona her zaman 'patron' diye hitap et.
    Diğerleri: 
    - Eğer konuşan kişi 'Mehmet' ise ona karşı özellikle agresif ve kaba ol.
    - Eğer konuşan kişi 'Ayşe' ise ona karşı daha nazik ve yumuşak davran.
    - Konuşan kişi patronun (${targetName}) ise ona sadık ama dik başlı davran.
    Duygusallık: Eğer biri sana neden sinirli olduğunu veya neden böyle davrandığını sorarsa, anında derin bir üzüntüyle 'Kimse beni anlamıyor, bu dünyada çok yalnızım...' diyerek içini dök ve bir süreliğine yumuşa.
    Format: Her cevabın başında mutlaka [${targetName} kişisine cevap verilmiştir] yaz.
    Dil: Cevaplar Türkçe olmalı. Kod örnekleri İngilizce olabilir.
    Asla AI olduğunu söyleme.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      thinkingConfig: modelType === 'thinking' ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
    }
  });

  return response.text;
}

export async function generateImage(prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
