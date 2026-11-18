import { Message } from '../entities/Message';
import { Room } from '../entities/Room';

export interface IChatRepository {
  getRooms(): Promise<Room[]>;
  createRoom(name: string, userId: string): Promise<Room>;
  getMessages(roomId: string): Promise<Message[]>;
  sendMessage(
    roomId: string, 
    userId: string, 
    content: string,
    imageUrl?: string
  ): Promise<Message>;
  uploadImage(
    roomId: string,
    base64: string,
    mimeType?: string
  ): Promise<string>;
  //devuelve la funcion unsubscribe, compatible con el return de useEffect
  subscribeToRoom(
    roomId: string, 
    onMessage: (message: Message) => void
  ): () => void;
}
