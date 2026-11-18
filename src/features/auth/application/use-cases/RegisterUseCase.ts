import { AuthError } from "../../../../shared/domain/errors/AppError"
import { User } from '../../domain/entities/User';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';

export class RegisterUseCase {
  constructor(private authRepo: IAuthRepository) {}

  async execute(email: string, password: string, username: string): Promise<User> {
    if (!email || !password || !username) 
      throw new AuthError('todos los campos son requeridos');
    if (password.length < 6)
      throw new AuthError("la contraseña debe tener al menos 6 caracteres")
    if (username.includes(' '))
      throw new AuthError("El username no puede contener espacios")
    try {
      return this.authRepo.register(email, password, username);
    } catch (error) {
      const message = error instanceof Error ? error.message: "Error al registrar usuario";
      throw new AuthError(message, error)
    }
  }
}
