// eslint-disable-next-line max-classes-per-file
import FilePoly from '../../polyfill/filePoly.js';
import File from '../files/file.js';
import Patch from './patch.js';

class PPFHeader {
  readonly version: number;

  readonly undoDataAvailable: boolean;

  constructor(version: number, undoDataAvailable: boolean) {
    this.version = version;
    this.undoDataAvailable = undoDataAvailable;
  }

  static async fromFilePoly(patchFile: FilePoly): Promise<PPFHeader> {
    const header = (await patchFile.readNext(5)).toString();
    if (!header.startsWith('PPF')) {
      await patchFile.close();
      throw new Error(`PPF patch header is invalid: ${patchFile.getPathLike()}`);
    }
    const encoding = (await patchFile.readNext(1)).readUInt8();
    const version = encoding + 1;
    if (!header.endsWith(`${version}0`)) {
      await patchFile.close();
      throw new Error(`PPF patch header has an invalid version: ${patchFile.getPathLike()}`);
    }
    patchFile.skipNext(50); // description

    let blockCheckEnabled = false;
    let undoDataAvailable = false;
    if (version === 2) {
      patchFile.skipNext(4); // size of base file
      blockCheckEnabled = true;
    } else if (version === 3) {
      patchFile.skipNext(1); // image type
      blockCheckEnabled = (await patchFile.readNext(1)).readUInt8() === 0x01;
      undoDataAvailable = (await patchFile.readNext(1)).readUInt8() === 0x01;
      patchFile.skipNext(1); // dummy
    } else {
      await patchFile.close();
      throw new Error(`PPF v${version} isn't supported: ${patchFile.getPathLike()}`);
    }
    if (blockCheckEnabled) {
      patchFile.skipNext(1024);
    }

    return new PPFHeader(version, undoDataAvailable);
  }
}

/**
 * @link https://winningeleven-games.com/thread-9609-post-29416.html#pid29416
 * @link https://github.com/meunierd/ppf/blob/master/ppfdev/PPF3.txt
 */
export default class PPFPatch extends Patch {
  static readonly SUPPORTED_EXTENSIONS = ['.ppf'];

  static patchFrom(file: File): PPFPatch {
    const crcBefore = Patch.getCrcFromPath(file.getExtractedFilePath());
    return new PPFPatch(file, crcBefore);
  }

  async apply<T>(inputFile: File, callback: (tempFile: string) => (Promise<T> | T)): Promise<T> {
    return this.getFile().extractToFilePoly('r', async (patchFile) => {
      const header = await PPFHeader.fromFilePoly(patchFile);

      return PPFPatch.writeOutputFile(inputFile, callback, patchFile, header);
    });
  }

  private static async writeOutputFile<T>(
    inputFile: File,
    callback: (tempFile: string) => (Promise<T> | T),
    patchFile: FilePoly,
    header: PPFHeader,
  ): Promise<T> {
    return inputFile.extractToTempFile(async (tempFile) => {
      const targetFile = await FilePoly.fileFrom(tempFile, 'r+');

      try {
        /* eslint-disable no-await-in-loop */
        while (!patchFile.isEOF()) {
          await PPFPatch.applyPatchBlock(patchFile, targetFile, header);
        }
      } finally {
        await targetFile.close();
      }

      return callback(tempFile);
    });
  }

  private static async applyPatchBlock(
    patchFile: FilePoly,
    targetFile: FilePoly,
    header: PPFHeader,
  ): Promise<void> {
    const peek = (await patchFile.peekNext(18)).toString();
    if (!peek) {
      // End of file
      return;
    }
    if (peek === '@BEGIN_FILE_ID.DIZ') {
      // TODO(cemmer): handle?
      return;
    }

    let offset = 0;
    if (header.version === 2) {
      offset = (await patchFile.readNext(4)).readUInt32LE();
    } else if (header.version === 3) {
      offset = (await patchFile.readNext(4)).readUInt32LE()
        + ((await patchFile.readNext(4)).readUInt32LE() * 0x100000000);
    }

    const bytesToChange = (await patchFile.readNext(1)).readUInt8();
    const data = await patchFile.readNext(bytesToChange);
    if (header.undoDataAvailable) {
      patchFile.skipNext(bytesToChange);
    }

    await targetFile.writeAt(data, offset);
  }
}
