import { Stack } from 'expo-router';

export default function PlusLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Plus', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="idees/index" options={{ title: 'Boîte à idées', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="idees/[id]" options={{ title: '' }} />
      <Stack.Screen name="idees/nouvelle" options={{ title: 'Nouvelle idée', presentation: 'modal' }} />
      <Stack.Screen name="liens" options={{ title: 'Liens utiles', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="compte" options={{ title: 'Mon compte', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}
