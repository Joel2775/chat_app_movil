export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  imageUrl?: string;
  createdAt: Date;
  authorUsername?: string;
}
