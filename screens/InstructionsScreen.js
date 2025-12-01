// screens/InstructionsScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function InstructionsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How to Measure Pulse</Text>
      <Text style={styles.instruction}>1. Place your fingertip fully on the rear camera lens.</Text>
      <Text style={styles.instruction}>2. Keep still and do not press too hard.</Text>
      <Text style={styles.instruction}>3. The flash will turn on automatically.</Text>
      <Text style={styles.instruction}>4. Stay still until the measurement is done.</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("PulseScan")}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, justifyContent:'center', alignItems:'center', padding:20, backgroundColor:'#fff' },
  title:{ fontSize:24, fontWeight:'700', marginBottom:20 },
  instruction:{ fontSize:16, marginVertical:6, textAlign:'center' },
  button:{ marginTop:30, backgroundColor:'#0a84ff', paddingVertical:14, paddingHorizontal:30, borderRadius:12 },
  buttonText:{ color:'#fff', fontWeight:'700', fontSize:16 },
});
