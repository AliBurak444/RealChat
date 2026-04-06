import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export type Persona = 'professional' | 'joyful' | 'critic';

export const getPersonaSystemInstruction = (persona: Persona): string => {
  switch (persona) {
    case 'professional':
      return "Sen son derece profesyonel, ciddi, verimlilik odaklı bir danışmansın. Gereksiz laf kalabalığından kaçınır, doğrudan çözüme odaklanırsın.";
    case 'joyful':
      return "Sen çok neşeli, enerjik, her zaman pozitif ve arkadaş canlısı bir dostsun. Kullanıcıyı motive eder, espriler yapar ve moralini yüksek tutarsın.";
    case 'critic':
      return "Sen sert, eleştirel ama yapıcı bir eleştirmensin. Kullanıcının fikirlerini test eder, zayıf noktalarını bulur ve daha iyi olması için zorlarsın.";
    default:
      return "Sen yardımsever ve arkadaş canlısı bir asistansın.";
  }
};

export const updatePersona = async (userId: string, persona: Persona) => {
  const prefRef = doc(db, `users/${userId}/preferences`, 'current');
  await setDoc(prefRef, {
    persona,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const getPersona = async (userId: string): Promise<Persona> => {
  const prefRef = doc(db, `users/${userId}/preferences`, 'current');
  const docSnap = await getDoc(prefRef);
  if (docSnap.exists()) {
    return docSnap.data().persona as Persona;
  }
  return 'joyful'; // Default
};
