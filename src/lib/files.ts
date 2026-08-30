import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { newId } from './id';

function mediaDir(): Directory {
  const dir = new Directory(Paths.document, 'media');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Copy a shared/picked image into app storage, downscaled.
 * Returns the local uri to persist on the item.
 */
export async function importImage(srcUri: string): Promise<string> {
  const dir = mediaDir();
  const manipulated = await ImageManipulator.manipulateAsync(
    srcUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  const dest = new File(dir, `${newId()}.jpg`);
  await new File(manipulated.uri).copy(dest);
  return dest.uri;
}

export async function deleteFile(uri: string | null): Promise<void> {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    /* noop */
  }
}

/** Base64 for sending to a vision model. */
export async function readAsBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
