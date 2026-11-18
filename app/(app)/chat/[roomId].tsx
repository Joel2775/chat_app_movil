import { useAuthStore } from "@features/auth/presentation/store/authStore";
import { Message } from "@features/chat/domain/entities/Message";
import { useChat } from "@features/chat/presentation/hooks/useChat";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

// Colores para avatares de participantes
const AUTHOR_COLORS = [
  "#4F46E5",
  "#059669",
  "#D97706",
  "#DB2777",
  "#7C3AED",
  "#2563EB",
  "#0891B2",
];

function getAuthorColor(name?: string) {
  if (!name) return "#4F46E5";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AUTHOR_COLORS.length;
  return AUTHOR_COLORS[index];
}

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { messages, sendMessage, sendImageMessage, isSending, isLoading } = useChat(roomId);
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Animación del botón enviar
  const sendScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || isUploading) return;

    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    sendMessage(input.trim());
    setInput("");
  }, [input, sendMessage, isSending, isUploading]);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permiso requerido",
          "Necesitamos acceso a tus fotos para poder compartirlas en el chat.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      const asset = result.assets?.[0];
      if (!result.canceled && asset && asset.base64) {
        setIsUploading(true);
        await sendImageMessage({
          base64: asset.base64,
          mimeType: asset.mimeType ?? "image/jpeg",
          content: input.trim(),
        });
        setInput("");
      }
    } catch (err: any) {
      Alert.alert("Error al subir imagen", err.message || "No se pudo enviar la foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const renderMsg = ({ item }: { item: Message }) => {
    const isOwn = item.userId === user?.id;
    const authorInitial = item.authorUsername?.charAt(0).toUpperCase() || "?";
    const authorBg = getAuthorColor(item.authorUsername);

    return (
      <View style={[styles.messageRow, isOwn ? styles.rowOwn : styles.rowOther]}>
        {/* Avatar pequeño para otros usuarios */}
        {!isOwn && (
          <View style={[styles.authorAvatar, { backgroundColor: authorBg }]}>
            <Text style={styles.authorAvatarText}>{authorInitial}</Text>
          </View>
        )}

        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {!isOwn && item.authorUsername && (
            <Text style={[styles.authorName, { color: authorBg }]}>
              @{item.authorUsername}
            </Text>
          )}

          {/* Imagen adjunta */}
          {item.imageUrl ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.messageImage}
                contentFit="cover"
                transition={200}
              />
            </View>
          ) : null}

          {/* Texto del mensaje */}
          {item.content ? (
            <Text style={[styles.messageText, isOwn ? styles.textOwn : styles.textOther]}>
              {item.content}
            </Text>
          ) : null}

          {/* Hora */}
          <Text style={[styles.timeText, isOwn ? styles.timeOwn : styles.timeOther]}>
            {item.createdAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 80}
    >
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando mensajes...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMsg}
          contentContainerStyle={
            messages.length === 0 ? styles.emptyContainer : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContent}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIconText}>💬</Text>
              </View>
              <Text style={styles.emptyTitle}>¡Comienza la conversación!</Text>
              <Text style={styles.emptySubtitle}>
                Envía el primer mensaje o comparte una foto con el botón 📷
              </Text>
            </View>
          }
        />
      )}

      {/* Barra de Entrada de Mensaje */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.attachButton, isUploading && styles.attachButtonDisabled]}
          onPress={handlePickImage}
          disabled={isUploading || isSending}
          activeOpacity={0.7}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : (
            <Text style={styles.attachIcon}>📷</Text>
          )}
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isUploading ? "Subiendo imagen..." : "Escribe un mensaje..."}
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
            editable={!isUploading}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || isSending || isUploading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isSending || isUploading}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748B",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 4,
    alignItems: "flex-end",
  },
  rowOwn: {
    justifyContent: "flex-end",
  },
  rowOther: {
    justifyContent: "flex-start",
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 2,
  },
  authorAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: "#4F46E5",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  authorName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 4,
    backgroundColor: "#E2E8F0",
  },
  messageImage: {
    width: 240,
    height: 200,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textOwn: {
    color: "#FFFFFF",
  },
  textOther: {
    color: "#0F172A",
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timeOwn: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  timeOther: {
    color: "#94A3B8",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  attachButtonDisabled: {
    opacity: 0.6,
  },
  attachIcon: {
    fontSize: 20,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    maxHeight: 110,
  },
  input: {
    fontSize: 15,
    color: "#0F172A",
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: "#4F46E5",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 2,
  },
});
