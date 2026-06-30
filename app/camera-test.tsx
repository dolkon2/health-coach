/**
 * camera-test — TEMPORARY scaffolding for Ring 2 Pass 2.7a (camera infrastructure).
 *
 * Not in the tab bar; reachable only by direct route (`/camera-test`). Its only
 * job is to prove, on a physical device running the dev client, that the camera
 * opens, the barcode scanner reads a UPC/EAN, and a still capture returns a URI —
 * before any of it is wired into real food logging. Nothing here persists an
 * Observation. Pass 2.7b replaces this with the real barcode scan + resolution UI.
 */
import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Screen, Text, Button } from '@/components';
import { useTheme } from '@/theme';

export default function CameraTestScreen() {
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);

  async function handleCapture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
    if (photo?.uri) setLastPhotoUri(photo.uri);
  }

  // Permission state still resolving.
  if (!permission) {
    return (
      <Screen>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Checking camera permission…
        </Text>
      </Screen>
    );
  }

  // Not granted yet — ask plainly.
  if (!permission.granted) {
    return (
      <Screen>
        <Text variant="label" color={theme.colors.sandstone}>
          Camera test
        </Text>
        <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
          Camera access needed
        </Text>
        <Text
          variant="bodySm"
          color={theme.colors.textMuted}
          style={{ marginTop: theme.spacing[4] }}
        >
          This temporary screen needs the camera to test barcode scanning and photo
          capture. Nothing is saved.
        </Text>
        <View style={{ height: theme.spacing[8] }} />
        <Button label="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  // Granted — live preview + the two smoke tests.
  return (
    <Screen>
      <Text variant="label" color={theme.colors.sandstone}>
        Camera test (temporary)
      </Text>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        2.7a smoke test
      </Text>

      <View
        style={[
          styles.preview,
          { marginTop: theme.spacing[6], borderColor: theme.colors.border },
        ]}
      >
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'ean8'] }}
          onBarcodeScanned={(result) => {
            setLastBarcode(`${result.type} · ${result.data}`);
            setScanCount((n) => n + 1);
          }}
        />
      </View>

      <View style={{ marginTop: theme.spacing[6] }}>
        <Text variant="label">Last barcode</Text>
        <Text
          variant="dataSm"
          color={theme.colors.text}
          style={{ marginTop: theme.spacing[1] }}
        >
          {lastBarcode ?? '— point at a UPC/EAN —'}
        </Text>
        <Text
          variant="bodySm"
          color={theme.colors.textMuted}
          style={{ marginTop: theme.spacing[1] }}
        >
          scans: {scanCount}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing[5] }}>
        <Text variant="label">Last photo URI</Text>
        <Text
          variant="bodySm"
          color={theme.colors.textMuted}
          style={{ marginTop: theme.spacing[1] }}
        >
          {lastPhotoUri ?? '— none captured —'}
        </Text>
      </View>

      <View style={{ height: theme.spacing[6] }} />
      <Button label="Capture photo" onPress={handleCapture} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
