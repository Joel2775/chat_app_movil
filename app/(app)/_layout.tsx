import { useAuth } from "@features/auth/presentation/hooks/useAuth";
import { Stack } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function AppLayout() {
  const { logout } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#4F46E5",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Salas de Chat",
          headerRight: () => (
            <TouchableOpacity
              onPress={logout}
              style={styles.logoutButton}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="chat/[roomId]"
        options={{
          title: "Conversación",
          headerBackTitle: "Salas",
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
