import { Stack } from 'expo-router';

export default function ActusLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Actus', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="actu/[id]" options={{ title: '' }} />
    </Stack>
  );
}
