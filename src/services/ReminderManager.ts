import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface Reminder {
  id?: string;
  userId: string;
  text: string;
  dueDate: Date;
  completed: boolean;
}

export const addReminder = async (userId: string, text: string, dueDate: Date) => {
  const reminderRef = collection(db, `users/${userId}/reminders`);
  await addDoc(reminderRef, {
    userId,
    text,
    dueDate: Timestamp.fromDate(dueDate),
    completed: false,
    createdAt: serverTimestamp()
  });
};

export const getReminders = async (userId: string): Promise<Reminder[]> => {
  const reminderRef = collection(db, `users/${userId}/reminders`);
  const q = query(reminderRef, where("completed", "==", false));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    dueDate: (doc.data().dueDate as Timestamp).toDate()
  } as Reminder));
};
