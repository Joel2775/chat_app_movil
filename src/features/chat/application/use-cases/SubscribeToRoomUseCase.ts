import { IChatRepository } from '../../domain/repositories/IChatRepository';
import { Message } from '../../domain/entities/Message';

export class SubscribeToRoomUseCase {
  constructor(private readonly chatRepo: IChatRepository) {}

  execute(roomId: string, onMessage: (message: Message) => void): () => void {
    return this.chatRepo.subscribeToRoom(roomId, onMessage);
  }
}
