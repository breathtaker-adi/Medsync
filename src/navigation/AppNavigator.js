// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import the screens we will build
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import MedicationAlertScreen from '../screens/MedicationAlertScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="RoleSelection" 
        screenOptions={{ headerShown: false }} // We hide the default top bar for a cleaner mobile look
      >
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="MedicationAlert" component={MedicationAlertScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}