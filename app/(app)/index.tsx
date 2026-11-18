import { useAuthStore } from "@features/auth/presentation/store/authStore";
import { Room } from "@features/chat/domain/entities/Room";
import { useRooms } from "@features/chat/presentation/hooks/useRooms";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Paleta de colores para los avatares de las salas
const AVATAR_COLORS = [
  "#4F46E5", // Indigo
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function RoomsScreen() {
  const { rooms, isLoading, createRoom, isCreating, createError } = useRooms();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Animaciones para el modal
  const modalFade = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(60)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  // Filtrado de salas
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    return rooms.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
    );
  }, [rooms, searchQuery]);

  const openModal = () => {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(modalFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(modalSlide, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalSlide, {
        toValue: 60,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      setRoomName("");
    });
  };

  const handleCreate = () => {
    if (!roomName.trim() || isCreating) return;
    createRoom(roomName.trim(), {
      onSuccess: () => {
        closeModal();
      },
    });
  };

  const renderRoom = ({ item }: { item: Room }) => {
    const avatarBg = getAvatarColor(item.name);
    const initial = item.name.charAt(0).toUpperCase() || "#";

    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() => router.push(`/chat/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.roomContent}>
          <View style={styles.roomHeaderRow}>
            <Text style={styles.roomName} numberOfLines={1}>
              # {item.name}
            </Text>
            <Text style={styles.roomDate}>
              {item.createdAt.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <Text style={styles.roomSubtitle}>Toca para entrar a la sala</Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Cargando salas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Banner de Bienvenida */}
      <View style={styles.welcomeBanner}>
        <View style={styles.userInfo}>
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <View>
            <Text style={styles.greetingText}>
              Hola, <Text style={styles.usernameText}>@{user?.username || "Usuario"}</Text> 👋
            </Text>
            <Text style={styles.userSubText}>
              {rooms.length} {rooms.length === 1 ? "sala disponible" : "salas disponibles"}
            </Text>
          </View>
        </View>

        {/* Barra de Búsqueda */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar sala por nombre..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Lista de Salas */}
      <FlatList
        data={filteredRooms}
        keyExtractor={(r) => r.id}
        renderItem={renderRoom}
        contentContainerStyle={
          filteredRooms.length === 0 ? styles.emptyListContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Text style={styles.emptyIcon}>💬</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No se encontraron salas" : "No hay salas aún"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "Prueba con otro término de búsqueda."
                : "Sé el primero en crear una sala para comenzar a chatear."}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.emptyButton} onPress={openModal}>
                <Text style={styles.emptyButtonText}>+ Crear primera sala</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Botón Flotante (FAB) */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={openModal}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Modal para Crear Sala */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View style={[styles.overlay, { opacity: modalFade }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
            activeOpacity={1}
          />

          <Animated.View
            style={[
              styles.dialog,
              { transform: [{ translateY: modalSlide }] },
            ]}
          >
            <View style={styles.dialogHeader}>
              <View style={styles.dialogIconBg}>
                <Text style={styles.dialogIcon}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>Nueva Sala</Text>
                <Text style={styles.dialogSubtitle}>
                  Crea un canal temático para tu equipo
                </Text>
              </View>
            </View>

            {createError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>⚠️ {createError}</Text>
              </View>
            ) : null}

            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Nombre del canal</Text>
              <Text style={styles.charCount}>{roomName.length}/50</Text>
            </View>

            <View style={styles.dialogInputWrapper}>
              <Text style={styles.hashPrefix}>#</Text>
              <TextInput
                style={styles.dialogInput}
                placeholder="ej: general, proyectos, diseño..."
                placeholderTextColor="#94A3B8"
                value={roomName}
                onChangeText={setRoomName}
                autoFocus
                maxLength={50}
              />
            </View>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeModal}
                disabled={isCreating}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!roomName.trim() || isCreating) && styles.createBtnDisabled,
                ]}
                onPress={handleCreate}
                disabled={!roomName.trim() || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createText}>Crear Sala</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  welcomeBanner: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  userBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
  },
  userBadgeText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4F46E5",
  },
  greetingText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  usernameText: {
    color: "#4F46E5",
    fontWeight: "800",
  },
  userSubText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  clearSearch: {
    fontSize: 14,
    color: "#94A3B8",
    padding: 4,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  roomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  roomContent: {
    flex: 1,
  },
  roomHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
  roomDate: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  roomSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },
  chevron: {
    fontSize: 22,
    color: "#CBD5E1",
    fontWeight: "300",
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  fabContainer: {
    position: "absolute",
    right: 20,
    bottom: 24,
  },
  fab: {
    backgroundColor: "#4F46E5",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "400",
    marginTop: -2,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
    padding: 16,
  },
  dialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: Platform.OS === "ios" ? 20 : 8,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  dialogIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dialogIcon: {
    fontSize: 22,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  dialogSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  modalErrorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "500",
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  charCount: {
    fontSize: 12,
    color: "#94A3B8",
  },
  dialogInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 20,
  },
  hashPrefix: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4F46E5",
    marginRight: 6,
  },
  dialogInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  cancelText: {
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
  },
  createBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
