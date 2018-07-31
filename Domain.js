const Queue = require('better-queue');

module.exports = class Domain {
  // Domain
  // Create object
  // Set name from passing argument
  // Query script tags and find DL then regex for DL version
  // Set the date

  constructor(url, DLassetUrl, styleGuideUrl, Collector) {
    this.url = url;
    this.DLassetUrl = DLassetUrl;
    this.styleGuideUrl = styleGuideUrl;
    this.Collector = Collector;
    this.DLversion = null;
    this.urls = [url];
    this.DLselectors = [];
    this.DLlegacySelectors = [];
    this.Queue = null;
    this.ignoreExtTypes = ['zip', 'sketch', 'ai'];

    this.result = {
      domain: url,
      date: Date.now(),
      version: null,
      urls: this.urls,
      selectors: {
        match: [],
        not_match: [],
        legacy: []
      },
      page: {}
    };

    this.setupBatching();
  }

  setupBatching() {
    this.Queue = new Queue((batch, cb) => {

      Promise.all(batch.map(url => this.searchMoreUrls(url)))
        .then(() => {
          console.log(this.Queue.getStats());
            cb();

        })
        .catch(console.log);

    }, { batchSize: 10 });

    this.Queue.on('task_finish', (taskId, result, stats) => {});
    this.Queue.on('task_failed', function (taskId, err, stats) {console.log(err, stats)});
    this.Queue.on('empty', () => {});
  }

  /**
   *
   * @returns {Promise<any>}
   */
  gotoDomain() {
    return new Promise(async (resolve, reject) => {

      try {
        const sesh = await this.Collector.gotoPage(this.url);
        const scriptInfo = await this.Collector.collectScriptInfo(this.url, sesh,
          {
            attributesToCollect: {
              src: []
            }
          });

        // Loop through the src values and find the link to the assets.
        // Use the query string to determine the version number.
        scriptInfo.src.forEach((src) => {
          if (src !== null) {
            if (src.indexOf(this.DLassetUrl) !== -1) {
              this.DLversion = this.result.version = src.match(new RegExp('v=([0-9].*)'))[1].replace(/-/g, '.');
            }
          }
        });

        console.log('Design language version being used: ', this.DLversion);

        // Collect the selectors from the design language.
        await this.getDLselectors();

        try {
          // Collect all the hrefs from the landing page as a starting point.
          const collectedUrl = await this.Collector.collectUrls(this.urls[0], sesh);
          collectedUrl.map(url => this.setUrls(url));
        }
        catch (err) {
          console.log('Failed to collect urls from: ', this.url, err)
        }

        // Stop the browser session.
        sesh.browser.close();

        const passResolve = () => {
          console.log('The total urls collected: ', this.result.urls.length);
          resolve(this.result);
        };

        this.Queue.on('drain', passResolve);

      }
      catch (e) {
        reject(new Error('Failed to collect script info from: ' + this.url));
      }

    });
  }

  searchMoreUrls(url) {
    return new Promise(async (pass, fail) => {
        const sesh = await this.Collector.gotoPage(url);
        try {
          // Collect classes
          const classes = await this.Collector.collectSelectors(url, sesh);
          classes.map((selector) => {
            this.setSelector(selector, url);
          })
        }
        catch (e) {
          throw new Error('Failed to collect selectors from ' + url + ' error: ' + e);
        }

        try {
          // Collect urls
          const urls = await this.Collector.collectUrls(url, sesh);
          // Loop through the collected urls send them to be de-duped and scanned.
          urls.map(async (url) => {
            await this.setUrls(url);
          });
        }
        catch (e) {
          throw new Error('Failed to collect urls from ' + url + ' error: ' + e);
        }

      // Stop the browser session.
      sesh.browser.close();

        console.log('Total searches left to complete: ', (this.urls.length - this.Queue.getStats().total));
        return pass(url);
      });
  }

  setSelector(selector, url) {
    const match = this.result.selectors.match;
    const not_match = this.result.selectors.not_match;
    const legacy = this.result.selectors.legacy;

    // Setup per page objects.
    this.result.page[url] = this.result.page[url] || {};
    this.result.page[url].match = this.result.page[url].match || [];
    this.result.page[url].not_match = this.result.page[url].not_match || [];
    this.result.page[url].legacy = this.result.page[url].legacy || [];

    const page_match = this.result.page[url].match;
    const page_not_match = this.result.page[url].not_match;
    const page_legacy = this.result.page[url].legacy;

    if (this.DLselectors.includes(selector)) {
      this.result.selectors.match = !match.includes(selector) ? match.concat(selector) : match;
      this.result.page[url].match = !page_match.includes(selector) ? page_match.concat(selector) : page_match;
    }
    else if (this.DLlegacySelectors.includes(selector)) {
      this.result.selectors.legacy = !legacy.includes(selector) ? legacy.concat(selector) : legacy;
      this.result.page[url].legacy = !page_legacy.includes(selector) ? page_legacy.concat(selector) : page_legacy;
    }
    else {
      this.result.selectors.not_match = !not_match.includes(selector) ? not_match.concat(selector) : not_match;
      this.result.page[url].not_match = !page_not_match.includes(selector) ? page_not_match.concat(selector) : page_not_match;
    }
  }

  async setUrls(url) {
    const urlParts = url.split('.');
    if (!this.urls.includes(url) && this.ignoreExtTypes.indexOf(urlParts[urlParts.length - 1]) === -1 ) {
      this.urls.push(url);
      this.addSearches(url);
    }
  }

  async getDLselectors() {
    const sesh = await this.Collector.gotoPage(this.styleGuideUrl);

    this.DLselectors = await this.Collector.collectSelectors(this.styleGuideUrl, sesh);

    // Generated a legacy selector array by stripping out the rc prefix.
    this.DLlegacySelectors = this.DLselectors.map((selector) => {
      return selector.replace('rc-', '');
    });

    // Stop the browser session.
    sesh.browser.close();
  }

  addSearches(url) {
    this.Queue.push(url);
  }

  getResult() {
    return this.result;
  }
};
