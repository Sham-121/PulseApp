// screens/PulseScanScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import PulseModule from './PulseNative'; // ✅ Fixed import path

const screenWidth = Dimensions.get('window').width;

const PulseScanScreen = () => {
  const [bpm, setBpm] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [history, setHistory] = useState({});

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await AsyncStorage.getItem('heartRateHistory');
      if (data) setHistory(JSON.parse(data));
    } catch (e) {
      console.warn('Failed to load history', e);
    }
  };

  // Listen for native module events
  useEffect(() => {
    // Listen for scan result
    const resultSub = PulseModule.addListener('PulseScanResult', async (event) => {
      console.log('Scan result:', event);
      const newBpm = event.bpm;
      
      if (newBpm > 0) {
        setBpm(newBpm);
        await saveBpm(newBpm);
      } else {
        Alert.alert('Detection Failed', 'Could not detect a reliable pulse. Try again with your fingertip covering the camera completely.');
      }
      
      setScanning(false);
      setSampleCount(0);
      setCurrentValue(0);
    });

    // Listen for samples during scan
    const sampleSub = PulseModule.addListener('PulseSample', (event) => {
      setCurrentValue(Math.round(event.value));
      setSampleCount(event.samples);
    });

    // Listen for scan started
    const startSub = PulseModule.addListener('PulseScanStarted', (event) => {
      console.log('Scan started, duration:', event.duration);
    });

    return () => {
      resultSub.remove();
      sampleSub.remove();
      startSub.remove();
    };
  }, []);

  const saveBpm = async (newBpm) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const updatedHistory = { ...history };
      if (!updatedHistory[today]) updatedHistory[today] = [];
      updatedHistory[today].push({ bpm: newBpm, timestamp: Date.now() });
      setHistory(updatedHistory);
      await AsyncStorage.setItem('heartRateHistory', JSON.stringify(updatedHistory));
    } catch (e) {
      console.warn('Failed to save BPM', e);
    }
  };

  const startNativeScan = async () => {
    Alert.alert(
      'How to Measure',
      'Place your fingertip COMPLETELY over the back camera.\n\n' +
      'Press GENTLY and stay STILL for 30 seconds.\n\n' +
      'The flash will turn on automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              setScanning(true);
              setSampleCount(0);
              setCurrentValue(0);
              setBpm(null);
              await PulseModule.startScan(30); // 30 second scan
            } catch (err) {
              setScanning(false);
              Alert.alert('Error', 'Failed to start scan: ' + err.message);
            }
          }
        }
      ]
    );
  };

  const stopScan = async () => {
    try {
      await PulseModule.stopScan();
      setScanning(false);
      setSampleCount(0);
      setCurrentValue(0);
    } catch (err) {
      console.error('Stop scan error:', err);
    }
  };

  const getHeartRateStatus = (bpmValue) => {
    if (!bpmValue) return '';
    if (bpmValue < 60) return 'Below Normal - Consider resting';
    if (bpmValue <= 100) return 'Normal Range - Healthy';
    return 'Above Normal - Try relaxing';
  };

  const getStatusColor = (bpmValue) => {
    if (!bpmValue) return '#666';
    if (bpmValue < 60) return '#0066cc';
    if (bpmValue <= 100) return '#28a745';
    return '#dc3545';
  };

  const getGraphData = () => {
    const last7days = [];
    const labels = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      labels.push(key.split('-')[2]); // day only
      
      const dayData = history[key];
      if (dayData && dayData.length > 0) {
        // Use average of all readings for that day
        const avg = dayData.reduce((sum, item) => sum + item.bpm, 0) / dayData.length;
        last7days.push(Math.round(avg));
      } else {
        last7days.push(0);
      }
    }
    
    return { labels, data: last7days };
  };

  const hasHistoryData = Object.keys(history).length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heart Rate Monitor</Text>
      <Text style={styles.subtitle}>Native PPG Implementation</Text>

      {!scanning && !bpm && (
        <>
          <View style={styles.instructionBox}>
            <Text style={styles.instructionTitle}>📱 Real PPG Technology</Text>
            <Text style={styles.instructionText}>
              This app uses your phone's camera and flash to detect blood flow changes in your fingertip.
              {'\n\n'}
              Place your fingertip over the back camera to begin a 30-second measurement.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={startNativeScan}>
            <Text style={styles.primaryButtonText}>Start Measurement (30s)</Text>
          </TouchableOpacity>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>✓ For Best Results:</Text>
            <Text style={styles.tipText}>• Sit down and relax for 1 minute first</Text>
            <Text style={styles.tipText}>• Cover camera completely with fingertip</Text>
            <Text style={styles.tipText}>• Press lightly, not hard</Text>
            <Text style={styles.tipText}>• Stay perfectly still</Text>
            <Text style={styles.tipText}>• Ensure good lighting</Text>
          </View>
        </>
      )}

      {scanning && (
        <View style={styles.scanBox}>
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraText}>🔦 Flash is ON</Text>
            <Text style={styles.cameraSubtext}>Keep finger pressed on back camera</Text>
          </View>

          <View style={styles.dataBox}>
            <Text style={styles.dataLabel}>Signal Intensity</Text>
            <View style={styles.signalBar}>
              <View style={[styles.signalFill, { width: `${Math.min(100, (currentValue / 255) * 100)}%` }]} />
            </View>
            <Text style={styles.dataValue}>{currentValue}</Text>
            <Text style={styles.dataSubtext}>{sampleCount} samples collected</Text>
          </View>

          <ActivityIndicator size="large" color="#0a84ff" style={styles.spinner} />
          <Text style={styles.scanText}>Analyzing pulse pattern...</Text>

          <TouchableOpacity style={styles.cancelButton} onPress={stopScan}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {bpm && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Your Heart Rate</Text>
          <View style={styles.bpmContainer}>
            <Text style={[styles.bpmLarge, { color: getStatusColor(bpm) }]}>{bpm}</Text>
            <Text style={styles.bpmUnit}>BPM</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bpm) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(bpm) }]}>
              {getHeartRateStatus(bpm)}
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setBpm(null)}>
            <Text style={styles.primaryButtonText}>Measure Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasHistoryData && !scanning && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Last 7 Days</Text>
          <LineChart
            data={{
              labels: getGraphData().labels,
              datasets: [{ data: getGraphData().data.map(v => v || 0) }],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#0a84ff',
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      <Text style={styles.disclaimer}>
        ⚠️ Not a medical device • For informational purposes only
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 20,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  instructionBox: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1976d2',
  },
  instructionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 250,
    marginVertical: 10,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  tipsBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 3,
    paddingLeft: 10,
  },
  scanBox: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
  },
  cameraPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    borderWidth: 3,
    borderColor: '#0a84ff',
  },
  cameraText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraSubtext: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  dataBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginTop: 15,
    alignItems: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  signalBar: {
    width: '100%',
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  signalFill: {
    height: '100%',
    backgroundColor: '#0a84ff',
    borderRadius: 10,
  },
  dataValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0a84ff',
  },
  dataSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  spinner: {
    marginTop: 20,
  },
  scanText: {
    marginTop: 10,
    fontWeight: '600',
    fontSize: 14,
    color: '#666',
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: '#f1f3f5',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: '#dc3545',
    fontWeight: '600',
    fontSize: 14,
  },
  resultBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  resultLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 15,
  },
  bpmContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  bpmLarge: {
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -3,
  },
  bpmUnit: {
    fontSize: 24,
    color: '#666',
    fontWeight: '600',
    marginTop: -5,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 30,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartContainer: {
    width: '100%',
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 10,
  },
  disclaimer: {
    textAlign: 'center',
    color: '#dc3545',
    fontSize: 11,
    paddingHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 10,
  },
});

export default PulseScanScreen;