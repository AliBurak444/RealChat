export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: any;
}

export interface ChatRoom {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
  members: string[]; // max 30
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'image';
  imageUrl?: string;
  createdAt: any;
}
