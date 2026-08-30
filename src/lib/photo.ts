import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';

/**
 * Pick an image to drop. On real devices this is the OS photo picker. Some
 * emulators ship without the modern Photo Picker activity, so we fall back to
 * the legacy `ACTION_GET_CONTENT` picker, and finally — in development only —
 * to a bundled sample image so the full drop → classify → confirm flow stays
 * testable. Production UX is unchanged: real devices always hit the first path.
 *
 * Returns a local uri, or null if the user cancelled.
 */
export async function pickImageUri(): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };

  try {
    const res = await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) return res.assets[0].uri;
    return null;
  } catch {
    // modern picker unavailable
  }

  if (Platform.OS === 'android') {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ ...opts, legacy: true });
      if (!res.canceled && res.assets[0]) return res.assets[0].uri;
      return null;
    } catch {
      // legacy picker unavailable too
    }
  }

  if (__DEV__) {
    const asset = Asset.fromModule(require('../../assets/sample-drop.png'));
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri;
  }

  return null;
}
