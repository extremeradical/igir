import fs from 'fs';
import path from 'path';
import util from 'util';

import Constants from '../../../src/constants.js';
import bufferPoly from '../../../src/polyfill/bufferPoly.js';
import fsPoly from '../../../src/polyfill/fsPoly.js';
import File from '../../../src/types/files/file.js';
import IPSPatch from '../../../src/types/patches/ipsPatch.js';

async function writeTemp(fileName: string, contents: string | Buffer): Promise<File> {
  const temp = fsPoly.mktempSync(path.join(Constants.GLOBAL_TEMP_DIR, fileName));
  await util.promisify(fs.writeFile)(temp, contents);
  return File.fileOf(temp);
}

describe('constructor', () => {
  test.each([
    // Non-existent
    'foo.ips',
    'fizz/buzz.ips',
    // Invalid
    'ABCDEFGH Blazgo.ips',
    'ABCD12345 Bangarang.ips',
    'Bepzinky 1234567.ips',
  ])('should throw if no CRC found: %s', async (filePath) => {
    const file = await File.fileOf(filePath, 0, '00000000');
    expect(() => IPSPatch.patchFrom(file)).toThrow(/couldn't parse/i);
  });

  test.each([
    // Beginning
    ['ABCD1234-Foo.ips', 'abcd1234'],
    ['Fizz/bcde2345_Buzz.ips', 'bcde2345'],
    ['One/Two/cdef3456 Three.ips', 'cdef3456'],
    // End
    ['Lorem+9876FEDC.ips', '9876fedc'],
    ['Ipsum#8765edcb.ips', '8765edcb'],
    ['Dolor 7654dcba.ips', '7654dcba'],
  ])('should find the CRC in the filename: %s', async (filePath, expectedCrc) => {
    const file = await File.fileOf(filePath, 0, '00000000');
    const patch = IPSPatch.patchFrom(file);
    expect(patch.getCrcBefore()).toEqual(expectedCrc);
  });
});

describe('apply', () => {
  test.each([
    // IPS
    ['AAAAAAAAAA', 'PATCH   BCDEOF', 'ABCDAAAAAA'],
    ['AAAAAAAAAA', 'PATCH   \tBCDEFGHIJEOF', 'ABCDEFGHIJ'],
    ['AAAAAAAAAAAAAAAAAAAA', 'PATCH   BCDEF     EEOF', 'ABCDEFAAAAAAAAAAEEEE'],
    // IPS32
    ['AAAAAAAAAA', 'IPS32    BCDEEOF', 'ABCDAAAAAA'],
    ['AAAAAAAAAA', 'IPS32    \tBCDEFGHIJEEOF', 'ABCDEFGHIJ'],
    ['AAAAAAAAAAAAAAAAAAAA', 'IPS32    BCDEF    EEEEEEOF', 'ABCDEFAAAAAAAAAAEEEE'],
  ])('should apply the patch #%#: %s', async (baseContents, patchContents, expectedContents) => {
    const rom = await writeTemp('ROM', baseContents);
    const patch = IPSPatch.patchFrom(await writeTemp('00000000 patch.ips', patchContents));

    await patch.apply(rom, async (tempFile) => {
      const actualContents = (
        await bufferPoly.fromReadable(fs.createReadStream(tempFile))
      ).toString();
      expect(actualContents).toEqual(expectedContents);
    });

    await fsPoly.rm(rom.getFilePath());
    await fsPoly.rm(patch.getFile().getFilePath());
  });
});
