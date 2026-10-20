import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { registerAttendance } from '@/lib/attendance';
import { getCurrentRole, useAuth, type UserRole } from '@/lib/auth';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const { user } = useAuth();

  // Load the current user's role so we can block non-students
  // from scanning before they ever open the camera.
  useEffect(() => {
    let active = true;

    if (!user) {
      setRole(null);
      return;
    }

    getCurrentRole().then((r) => {
      if (active) {
        setRole(r);
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  // ----------------------------------------------------------
  // Camera permission still loading
  // ----------------------------------------------------------

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Camera permission denied
  // ----------------------------------------------------------

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera Permission Needed</Text>

        <Text style={styles.subtitle}>
          We need access to your camera to scan QR codes.
        </Text>

        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Only students record attendance
  // ----------------------------------------------------------

  if (role && role !== 'student') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Students Only</Text>

        <Text style={styles.subtitle}>
          Attendance is recorded by student accounts. Teachers and
          administrators manage attendance from their own screens.
        </Text>
      </View>
    );
  }

  // ----------------------------------------------------------
  // A scanned QR code — handed to the database for validation
  // ----------------------------------------------------------

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (validating) {
      return;
    }

    setScanned(true);
    setValidating(true);
    setMessage(null);
    setSuccess(false);

    try {
      const result = await registerAttendance(data);

      setSuccess(result.success);

      setMessage(
        result.success && result.eventTitle
          ? `${result.message}\n${result.eventTitle}`
          : result.message
      );
    } catch {
      setSuccess(false);
      setMessage('Could not record attendance. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setValidating(false);
    setMessage(null);
    setSuccess(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay}>
        {validating ? (
          <>
            <ActivityIndicator size="small" color={COLORS.primary} />

            <Text style={styles.overlayText}>
              Validating attendance…
            </Text>
          </>
        ) : (
          <Text style={styles.overlayText}>
            {scanned
              ? 'QR Code detected'
              : 'Point your camera at a QR code'}
          </Text>
        )}

        {!validating && message && (
          <Text
            style={[
              styles.scanResult,
              success ? styles.success : styles.error,
            ]}
          >
            {message}
          </Text>
        )}

        {scanned && !validating && (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh"
            onPress={handleScanAgain}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },

  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 60,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },

  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 6,
    marginBottom: 6,
    textAlign: 'center',
  },

  scanResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },

  success: {
    color: '#2E7D32',
  },

  error: {
    color: '#C62828',
  },
});
