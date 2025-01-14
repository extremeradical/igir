import os from 'os';

import DATScanner from '../../src/modules/datScanner.js';
import Options from '../../src/types/options.js';
import ProgressBarFake from '../console/progressBarFake.js';

function createDatScanner(dat: string[]): DATScanner {
  return new DATScanner(new Options({ dat }), new ProgressBarFake());
}

it('should throw on nonexistent paths', async () => {
  await expect(createDatScanner(['/completely/invalid/path']).scan()).rejects.toThrow(/path doesn't exist/i);
  await expect(createDatScanner(['/completely/invalid/path', os.devNull]).scan()).rejects.toThrow(/path doesn't exist/i);
  await expect(createDatScanner(['/completely/invalid/path', 'test/fixtures/dats']).scan()).rejects.toThrow(/path doesn't exist/i);
  await expect(createDatScanner(['test/fixtures/**/*.tmp']).scan()).rejects.toThrow(/path doesn't exist/i);
  await expect(createDatScanner(['test/fixtures/dats/*foo*/*bar*']).scan()).rejects.toThrow(/path doesn't exist/i);
});

it('should return empty list on no results', async () => {
  await expect(createDatScanner([]).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['']).scan()).resolves.toEqual([]);
  await expect(createDatScanner([os.devNull]).scan()).resolves.toEqual([]);
});

it('should not throw on empty files', async () => {
  await expect(createDatScanner(['test/fixtures/**/empty.*']).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['test/fixtures/{dats,roms}/empty.*']).scan()).resolves.toEqual([]);
});

it('should not throw on non-DATs', async () => {
  await expect(createDatScanner(['test/fixtures/**/invalid.*']).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['test/fixtures/roms']).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['test/fixtures/roms/*']).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['test/fixtures/roms/*.rom']).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['test/fixtures/roms/invalid.*']).scan()).resolves.toEqual([]);
  await expect(createDatScanner(['test/fixtures/roms/invalid.*', 'test/fixtures/roms/invalid.*']).scan()).resolves.toEqual([]);
});

it('should scan multiple files', async () => {
  const expectedDatFiles = 3;
  await expect(createDatScanner(['test/fixtures/dats']).scan()).resolves.toHaveLength(expectedDatFiles);
  await expect(createDatScanner(['test/fixtures/dats/*']).scan()).resolves.toHaveLength(expectedDatFiles);
  await expect(createDatScanner(['test/fixtures/dats/*', 'test/fixtures/**/*.dat']).scan()).resolves.toHaveLength(expectedDatFiles);
  await expect(createDatScanner(['test/fixtures/**/*.{dat,zip}']).scan()).resolves.toHaveLength(expectedDatFiles);
  await expect(createDatScanner(['test/fixtures/**/*.{dat,zip}', 'test/fixtures/**/*.{dat,zip}']).scan()).resolves.toHaveLength(expectedDatFiles);
});

it('should scan single files', async () => {
  await expect(createDatScanner(['test/fixtures/dats/one.*']).scan()).resolves.toHaveLength(1);
  await expect(createDatScanner(['test/fixtures/*/one.zip']).scan()).resolves.toHaveLength(1);
  await expect(createDatScanner(['test/fixtures/dats/one.zip']).scan()).resolves.toHaveLength(1);
});
