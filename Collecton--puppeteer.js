
module.exports = class CollectonPuppeteer {
  constructor(url) {
    this.url = url;
  }

  async gotoPage(url) {
    const puppeteer = require('puppeteer');
    // Start a fresh instance of puppeteer.
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, {
      timeout: 3000000
    });

    return page;
  }

  async collectSelectors(url, page) {
    const classes = await page.$$eval('*', els => {
      let classHolder = {};
      els.forEach((el) => {
        let classes = el.getAttribute('class');
        if (classes !== null) {
          classes
            .split(' ')
            .forEach((selector) => {
              if (selector !== null && selector !== '') {
                classHolder[selector] = '';
              }
            });
        }
      });

      return Object.keys(classHolder);
    });

    return classes;
  }

  async collectUrls(url, page) {
    const cleanUrl = this.url.replace(/https:\/\/|http:\/\//g, '');

    const urls = await page.$$eval('a', (els, thisUrl) => {
      let links = {};
      els.forEach((el) => {
        const href = el.href.replace(/#|\?.*/g, '');

        // If this is in the same domain add it to the array of urls.
        // Remove the protocol as it's often not included.
        if (href.includes(thisUrl)) {
          links[href] = '';
        }
      });

      return links;
    }, cleanUrl);

    return Object.keys(urls);
  }

  async collectScriptInfo(url, page, options) {
    // Start by getting the DL version.
    // Add the protocol here as lots of links don't include it but it's required for chrome.
    await page.goto(url);
    return await page.$$eval('script', (scriptLink, attrs) => {
      // Loop through the script tag nodes.
      scriptLink.forEach((scpt) => {
        // Loop through the attributes requested and push found values.
        Object.keys(attrs).forEach((attr) => {
          switch (attr) {
            case 'src':
              attrs[attr].push(scpt.src);
              break;
            default:
              attrs[attr].push(scpt.getAttribute(attr));
          }
        });
      });
      return attrs;

    }, options.attributesToCollect);
  }
};
