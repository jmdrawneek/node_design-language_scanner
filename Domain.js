var Queue = require('better-queue');

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


    this.result = {
      domain: url,
      date: Date.now(),
      version: this.DLversion,
      urls: this.urls,
      selectors: {
        match: [],
        not_match: [],
        legacy: []
      }
    };

    this.setupBatching();
  }

  setupBatching() {
    this.Queue = new Queue((batch, cb) => {

      Promise.all(batch.map(url => this.searchMoreUrls(url)))
        .then(() => {
            cb();

        })
        .catch(console.log);

    }, { batchSize: 10 });


    this.Queue.on('task_finish', (taskId, result, stats) => {

    });

    this.Queue.on('task_failed', function (taskId, err, stats) {console.log(err, stats)});

    this.Queue.on('empty', () => {
    });
  }

  /**
   *
   * @returns {Promise<any>}
   */
  gotoDomain() {
    return new Promise(async (resolve, reject) => {

      try {
        const page = await this.Collector.gotoPage(this.url);
        const scriptInfo = await this.Collector.collectScriptInfo(this.url, page,
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
              this.DLversion = src.match(new RegExp('v=([0-9].*)'))[1].replace(/-/g, '.');
            }
          }
        });

        console.log('Design language version being used: ', this.DLversion);

        // Collect the selectors from the design language.
        await this.getDLselectors();

        try {
          // Collect all the hrefs from the landing page as a starting point.
          const collectedUrl = await this.Collector.collectUrls(this.urls[0], page);
          collectedUrl.map(url => this.setUrls(url));
        }
        catch (err) {
          console.log('Failed to collect urls from: ', this.url, err)
        }

        this.Queue.on('drain', () => {
          const totalUrls = this.urlCounter;
          console.log('The total urls collected from was ', totalUrls);
          return resolve(this.result);
        });

      }
      catch (e) {
        reject(new Error('Failed to collect script info from: ' + this.url));
      }

    });
  }

  searchMoreUrls(url) {
    return new Promise(async (pass, fail) => {
        const page = await this.Collector.gotoPage(url);
        try {
          // Collect classes
          const classes = await this.Collector.collectSelectors(url, page);
          classes.map((selector) => {
            this.setSelector = selector;
          })
        }
        catch (e) {
          throw new Error('Failed to collect selectors from ' + url + ' error: ' + e);
        }

        try {
          // Collect urls
          const urls = await this.Collector.collectUrls(url, page);
          // Loop through the collected urls send them to be de-duped and scanned.
          urls.map(async (url) => {
            await this.setUrls(url);
          });
        }
        catch (e) {
          throw new Error('Failed to collect urls from ' + url + ' error: ' + e);
        }

        console.log('Total searches left to complete: ', (this.urls.length - this.Queue.getStats().total));
        return pass(url);
      });
  }

  set setSelector(selector) {
    const match = this.result.selectors.match;
    const not_match = this.result.selectors.not_match;
    const legacy = this.result.selectors.legacy;

    if (this.DLselectors.includes(selector)) {
      this.result.selectors.match = !match.includes(selector) ? match.concat(selector) : match;
    }
    else if (this.DLlegacySelectors.includes(selector)) {
      this.result.selectors.legacy = !legacy.includes(selector) ? legacy.concat(selector) : legacy;
    }
    else {
      this.result.selectors.not_match = !not_match.includes(selector) ? not_match.concat(selector) : not_match;
    }
  }

  async setUrls(url) {
    if (!this.urls.includes(url)) {
      this.urls.push(url);
      this.addSearches(url);
    }
  }

  async getDLselectors() {
    const page = await this.Collector.gotoPage(this.styleGuideUrl);

    this.DLselectors = await this.Collector.collectSelectors(this.styleGuideUrl, page);

    // Generated a legacy selector array by stripping out the rc prefix.
    this.DLlegacySelectors = this.DLselectors.map((selector) => {
      return selector.replace('rc-', '');
    });
  }

  addSearches(url) {
    this.Queue.push(url);
  }

  getResult() {
    return this.result;
  }
};
