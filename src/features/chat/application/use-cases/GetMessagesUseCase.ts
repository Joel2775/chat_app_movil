import { IChatRepository } from '../../domain/repositories/IChatRepository';
import { Message } from '../../domain/entities/Message';

export class GetMessagesUseCase {
  constructor(private readonly chatRepo: IChatRepository) { }
  execute(roomId: string): Promise<Message[]> {
    return this.chatRepo.getMessages(roomId)
  }
}
