// App.js
import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import InstructionsScreen from './screens/InstructionsScreen';
//import PulseScanScreen from './screens/PulseScanScreen'; // pulse screen file
import AyurvedaBotScreen from './screens/AyurvedaBotScreen'; // Ayurveda bot screen file
import FoodScannerScreen from "./screens/FoodScannerScreen";
import BarcodeScannerNative from "./screens/BarcodeScannerNative";





const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: true }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Instructions" component={InstructionsScreen} />
          {/* <Stack.Screen name="PulseScan" component={PulseScanScreen} />  */}
          <Stack.Screen name="AyurvedaBot" component={AyurvedaBotScreen} /> 
          <Stack.Screen name="FoodScanner" component={FoodScannerScreen} />
        <Stack.Screen name="BarcodeScannerNative" component={BarcodeScannerNative} />


        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
