import ProgressBar, { Symbols } from '../console/progressBar.js';
import DAT from '../types/logiqx/dat.js';
import Parent from '../types/logiqx/parent.js';
import Options from '../types/options.js';
import ReleaseCandidate from '../types/releaseCandidate.js';
import Module from './module.js';

/**
 * Apply any specified filter and preference options to the release candidates for each
 * {@link Parent}.
 *
 * This class may be run concurrently with other classes.
 */
export default class CandidateFilter extends Module {
  private readonly options: Options;

  constructor(options: Options, progressBar: ProgressBar) {
    super(progressBar, CandidateFilter.name);
    this.options = options;
  }

  async filter(
    dat: DAT,
    parentsToCandidates: Map<Parent, ReleaseCandidate[]>,
  ): Promise<Map<Parent, ReleaseCandidate[]>> {
    await this.progressBar.logInfo(`${dat.getName()}: Filtering candidates`);

    if (!parentsToCandidates.size) {
      await this.progressBar.logDebug(`${dat.getName()}: No parents, so no candidates to filter`);
      return new Map();
    }

    // Return early if there aren't any candidates
    const totalReleaseCandidates = [...parentsToCandidates.values()]
      .reduce((sum, rcs) => sum + rcs.length, 0);
    if (!totalReleaseCandidates) {
      await this.progressBar.logDebug(`${dat.getName()}: No parent has candidates`);
      return new Map();
    }

    await this.progressBar.setSymbol(Symbols.FILTERING);
    await this.progressBar.reset(parentsToCandidates.size);

    const output = await this.filterSortFilter(dat, parentsToCandidates);

    const filteredCandidates = [...output.values()].reduce((sum, rc) => sum + rc.length, 0);
    await this.progressBar.logDebug(`${dat.getName()}: ${filteredCandidates.toLocaleString()} candidate${filteredCandidates !== 1 ? 's' : ''} after filtering`);

    await this.progressBar.logInfo(`${dat.getName()}: Done filtering candidates`);
    return output;
  }

  private async filterSortFilter(
    dat: DAT,
    parentsToCandidates: Map<Parent, ReleaseCandidate[]>,
  ): Promise<Map<Parent, ReleaseCandidate[]>> {
    const output = new Map<Parent, ReleaseCandidate[]>();

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < [...parentsToCandidates.entries()].length; i += 1) {
      const [parent, releaseCandidates] = [...parentsToCandidates.entries()][i];
      await this.progressBar.logTrace(`${dat.getName()}: ${parent.getName()}: ${releaseCandidates.length} candidates before filtering`);

      const filteredReleaseCandidates = releaseCandidates
        .filter((rc) => this.preFilter(rc))
        .sort((a, b) => this.sort(a, b))
        .filter((rc, idx) => this.postFilter(idx));
      await this.progressBar.logTrace(`${dat.getName()}: ${parent.getName()}: ${filteredReleaseCandidates.length} candidates after filtering`);
      output.set(parent, filteredReleaseCandidates);

      await this.progressBar.increment();
    }

    return output;
  }

  /** *******************
   *                    *
   *     Pre Filter     *
   *                    *
   ******************** */

  private preFilter(releaseCandidate: ReleaseCandidate): boolean {
    return [
      this.noLanguageAllowed(releaseCandidate),
      this.regionNotAllowed(releaseCandidate),
      this.options.getOnlyBios() && !releaseCandidate.getGame().isBios(),
      this.options.getNoBios() && releaseCandidate.getGame().isBios(),
      this.options.getOnlyRetail() && !releaseCandidate.getGame().isRetail(),
      this.options.getNoUnlicensed() && releaseCandidate.getGame().isUnlicensed(),
      this.options.getNoDemo() && releaseCandidate.getGame().isDemo(),
      this.options.getNoBeta() && releaseCandidate.getGame().isBeta(),
      this.options.getNoSample() && releaseCandidate.getGame().isSample(),
      this.options.getNoPrototype() && releaseCandidate.getGame().isPrototype(),
      this.options.getNoTestRoms() && releaseCandidate.getGame().isTest(),
      this.options.getNoAftermarket() && releaseCandidate.getGame().isAftermarket(),
      this.options.getNoHomebrew() && releaseCandidate.getGame().isHomebrew(),
      this.options.getNoUnverified() && !releaseCandidate.getGame().isVerified(),
      this.options.getNoBad() && releaseCandidate.getGame().isBad(),
    ].filter((val) => val).length === 0;
  }

  private noLanguageAllowed(releaseCandidate: ReleaseCandidate): boolean {
    if (this.options.getLanguageFilter().length) {
      const langs = this.options.getLanguageFilter();
      if (!releaseCandidate.getLanguages().some((lang) => langs.indexOf(lang) !== -1)) {
        return true;
      }
    }
    return false;
  }

  private regionNotAllowed(releaseCandidate: ReleaseCandidate): boolean {
    return this.options.getRegionFilter().length > 0
        && (
          !releaseCandidate.getRegion()
            || this.options.getRegionFilter().indexOf(releaseCandidate.getRegion() as string) === -1
        );
  }

  /** ****************
   *                 *
   *     Sorting     *
   *                 *
   ***************** */

  private sort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    return this.preferVerifiedSort(a, b)
        || this.preferGoodSort(a, b)
        || this.preferLanguagesSort(a, b)
        || this.preferRegionsSort(a, b)
        || this.preferRevisionSort(a, b)
        || this.preferRetailSort(a, b)
        || this.preferParentSort(a, b);
  }

  private preferVerifiedSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferVerified()) {
      return (a.getGame().isVerified() ? 0 : 1) - (b.getGame().isVerified() ? 0 : 1);
    }
    return 0;
  }

  private preferGoodSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferGood()) {
      return (b.getGame().isBad() ? 0 : 1) - (a.getGame().isBad() ? 0 : 1);
    }
    return 0;
  }

  private preferLanguagesSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferLanguages().length) {
      return this.preferLanguageSortValue(a) - this.preferLanguageSortValue(b);
    }
    return 0;
  }

  private preferLanguageSortValue(releaseCandidate: ReleaseCandidate): number {
    return releaseCandidate.getLanguages()
      .map((lang) => {
        const priority = this.options.getPreferLanguages().indexOf(lang);
        return priority !== -1 ? priority : Number.MAX_SAFE_INTEGER;
      })
      .reduce((min, idx) => Math.min(min, idx), Number.MAX_SAFE_INTEGER);
  }

  private preferRegionsSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferRegions().length) {
      return this.preferRegionSortValue(a) - this.preferRegionSortValue(b);
    }
    return 0;
  }

  private preferRegionSortValue(releaseCandidate: ReleaseCandidate): number {
    if (!releaseCandidate.getRegion()) {
      return Number.MAX_SAFE_INTEGER;
    }

    const regionIdx = this.options.getPreferRegions()
      .indexOf(releaseCandidate.getRegion() as string);
    return regionIdx !== -1 ? regionIdx : Number.MAX_SAFE_INTEGER;
  }

  private preferRevisionSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferRevisionNewer()) {
      return b.getRevision() - a.getRevision();
    } if (this.options.getPreferRevisionOlder()) {
      return a.getRevision() - b.getRevision();
    }
    return 0;
  }

  private preferRetailSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferRetail()) {
      return (a.getGame().isRetail() ? 0 : 1) - (b.getGame().isRetail() ? 0 : 1);
    }
    return 0;
  }

  private preferParentSort(a: ReleaseCandidate, b: ReleaseCandidate): number {
    if (this.options.getPreferParent()) {
      return (a.getGame().isParent() ? 0 : 1) - (b.getGame().isParent() ? 0 : 1);
    }
    return 0;
  }

  /** ********************
   *                     *
   *     Post Filter     *
   *                     *
   ********************* */

  private postFilter(idx: number): boolean {
    if (this.options.getSingle()) {
      return idx === 0;
    }
    return true;
  }
}
