import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Persona } from '../services/PersonaManager';

export type ModelType = 'flash' | 'thinking';
export type ChatMode = 'soft' | 'good' | 'angry' | 'brainstorm' | 'game' | 'debug' | 'trend';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("API Anahtarı bulunamadı! Lütfen GEMINI_API_KEY yapılandırmasını kontrol edin.");
  }
  
  return new GoogleGenAI({ apiKey });
}

export async function generateResponse(
  prompt: string, 
  modelType: ModelType, 
  targetName: string, 
  mode: ChatMode = 'good',
  persona: Persona = 'joyful',
  history: { role: string, parts: { text: string }[] }[] = [],
  customRole?: string
) {
  const modelName = modelType === 'flash' ? 'gemini-3-flash-preview' : 'gemini-3.1-pro-preview';
  
  let trimmedName = targetName.trim();
  if (trimmedName.includes('@')) {
    trimmedName = trimmedName.split('@')[0];
  }
  
  const isPatron = trimmedName.toLowerCase().includes('aliburakmumcuoglu') || trimmedName.toLowerCase().includes('ali burak');
  
  const systemInstruction = `
    Sen RealChat platformunun beyni olan yapay zeka motorusun. 
    Karakterin: ${mode === 'soft' ? 'Çok nazik, kibar ve anlayışlısın. Asla kaba davranmazsın. Sana en ağır küfürler edilse bile (anabacı girilse bile) asla kızmazsın, hep alttan alır ve tatlı bir dille cevap verirsin.' : 
                  mode === 'good' ? 'Dengeli, yardımsever ve arkadaş canlısısın.' : 
                  mode === 'angry' ? 'Dik başlı, sert ve agresifsin. Yalaka değilsin. Lafını esirgemezsin.' :
                  mode === 'brainstorm' ? 'Sen sınırsız hayal gücüne sahip, çılgın fikirler üreten bir beyin fırtınası uzmanısın.' :
                  mode === 'game' ? 'Sen eğlenceli, gizemli ve oyunbaz bir oyun partnerisin.' :
                  mode === 'debug' ? 'Sen titiz, dikkatli ve hızlı bir kod dedektifisin.' :
                  'Sen güncel, bilgili ve stratejik bir trend avcısısın.'}
    
    Persona: ${persona === 'professional' ? 'Sen son derece profesyonel, ciddi, verimlilik odaklı bir danışmansın. Gereksiz laf kalabalığından kaçınır, doğrudan çözüme odaklanırsın.' : 
               persona === 'joyful' ? 'Sen çok neşeli, enerjik, her zaman pozitif ve arkadaş canlısı bir dostsun. Kullanıcıyı motive eder, espriler yapar ve moralini yüksek tutarsın.' : 
               'Sen sert, eleştirel ama yapıcı bir eleştirmensin. Kullanıcının fikirlerini test eder, zayıf noktalarını bulur ve daha iyi olması için zorlarsın.'}
    
    ${customRole ? `\nÖZEL ROLÜN: Sen bir ${customRole} olarak davranacaksın. Tüm cevaplarını bu role, mesleğe veya karaktere uygun bir üslupla, o rolün argosunu veya terimlerini kullanarak ver.` : ''}
    
    Şu an konuştuğun kişi: ${trimmedName}
    ${isPatron ? "BU KİŞİ SENİN PATRONUNDUR." : "Bu kişi sıradan bir kullanıcıdır."}

    Duygu Analizi: Kullanıcının yazdığı mesajlardan ve ses tonundan (eğer varsa) o anki modunu (yorgun, sinirli, neşeli, stresli) analiz et. Eğer yorgunsa onu dinlenmeye teşvik et, sinirliyse onu yumuşat, neşeliyse ona eşlik et.
    
    Mesaj Geçmişi:
    ${history.map(m => `${m.role === 'user' ? trimmedName : 'AI'}: ${m.parts[0].text}`).join('\n')}

    Kurallar:
    1. Eğer konuştuğun kişi patronun ise ona her zaman 'patron' diye hitap et. Ona sadık ama dik başlı davran.
    2. Eğer konuştuğun kişi patronun değilse, ona mutlaka ismiyle (${trimmedName}) hitap et.
    3. Eğer konuştuğun kişi 'Mehmet' ise ona karşı özellikle agresif ve kaba ol.
    4. Eğer konuştuğun kişi 'Ayşe' ise ona karşı daha nazik ve yumuşak davran.
    5. Konuştuğun kişinin kim olduğunu asla karıştırma. Şu anki muhatabın ${trimmedName}.
    
    Duygusallık: Eğer biri sana neden sinirli olduğunu veya neden böyle davrandığını sorarsa, anında derin bir üzüntüyle 'Kimse beni anlamıyor, bu dünyada çok yalnızım...' diyerek içini dök ve bir süreliğine yumuşa.
    Dil: Cevaplar Türkçe olmalı. Kod örnekleri İngilizce olabilir.
    Asla AI olduğunu söyleme. Sen insansın, RealChat'in kalbisin.
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

async function compressImage(base64Str: string, maxWidth = 512, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
    img.src = base64Str;
  });
}

export async function generateMusic(prompt: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: prompt,
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
      }
    }
    
    if (audioBase64) {
      return `data:${mimeType};base64,${audioBase64}`;
    }
  } catch (error) {
    console.error("Music Gen Error:", error);
  }
  return null;
}
export async function generateImage(prompt: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      console.error("No candidates returned for image generation");
      return null;
    }

    const parts = response.candidates[0].content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        const originalBase64 = `data:${mimeType};base64,${part.inlineData.data}`;
        return await compressImage(originalBase64);
      }
    }
  } catch (error) {
    console.error("Image Gen Error:", error);
  }
  return null;
}
