async function(a) {
    const documentHtml = document.body.innerHTML.split('\n');

    // Wait for 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Scroll to the bottom of the page before scraping
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    const gotResponseFromPrerenderString = 'Got a response from Prerender';

    const appendObjectToDom = (className, value, key, cookie, content) => {
        const d = document.createElement('div');
        d.setAttribute('class', className);
        d.setAttribute('key', key);
        d.setAttribute('value', value);
        d.setAttribute('cookie', cookie && cookie.trim() || '');
        d.setAttribute('content', content);
        document.body.appendChild(d);
    };

    // Parse SuiteCommerce data
    try {
        const sText = documentHtml.find(a => a.includes('SuiteCommerce') && a.trim().startsWith('<!--'));
        const strs = sText.split(/]\s+\[/g);
        const keywords = ['prodbundle_id', 'baselabel', 'version', 'datelabel', 'buildno', 'ns_version'];
        const map = {};

        const envObj = SC.ENVIRONMENT.RELEASE_METADATA;

        strs.forEach(s => {
            keywords.forEach(k => {
                if (envObj && envObj.hasOwnProperty(k)) {
                    map[k] = envObj[k];
                } else if (s.includes(k)) {
                    map[k] = s.match(/[A-Z0-9a-z\._]+/g).pop();
                }
            });
        });

        Object.keys(map).forEach(k => {
            console.log(`Appending ${k} as ${map[k]}`);
            document.body.setAttribute(k, map[k]);
        });
        document.body.setAttribute('sText', sText);

        document.cookie.split(';').forEach(cookie => {
            const cSplit = cookie.split('=');
            appendObjectToDom('cookie', cSplit[0], cSplit[1], cookie);
        });
    } catch (e) {
        console.log('Something went wrong with SuiteCommerce Parsing', e);
    }

    // Parse SeoGenerator content
    try {
        const seoText = documentHtml.find(a => a.includes('SeoGenerator'));
        if (seoText) {
            document.body.setAttribute('seoText', seoText);
            const seoStr = seoText.match(/SeoGenerator:(\w+):(\w+)/g) ? seoText.match(/SeoGenerator:(\w+):(\w+)/g)[0] : '';
            if (seoStr.split(':').pop() === 'Error') {
                document.body.setAttribute('SeoGenerator', seoText);
            } else {
                document.body.setAttribute('SeoGenerator', 'OK');
            }
        } else {
            document.body.setAttribute('SeoGenerator', 'OK');
        }
    } catch (e) {
        console.log('There was an error while getting SeoGenerator data', e);
    }

    // Generic stuff
    try {
        const stringToCheck = [{
            key: 'gotResponseFromPrerender',
            text: gotResponseFromPrerenderString
        }, {
            key: 'Governance',
            text: 'The governance null limit was reached'
        }, {
            key: 'SSPAppContext',
            text: 'SSPAppContext'
        }];
        stringToCheck.forEach(sObj => {
            if (documentHtml.find(a => a.toLowerCase().includes(sObj.text.toLowerCase()))) {
                document.body.setAttribute(sObj.key, 'Yes');
            } else {
                document.body.setAttribute(sObj.key, 'No');
            }
        });

        const gotRespFromPreText = documentHtml.find(a => a.includes(stringToCheck[0].text));
        const gotResponseFromPrerenderTime = gotRespFromPreText ? gotRespFromPreText.replace(/.*\[\s{1,}.(\d+)\s{1,}(ms|MS)\s{1,}\].*/, '$1') : '0';

        document.body.setAttribute('gotResponseFromPrerenderTime', gotResponseFromPrerenderTime);
        document.body.setAttribute('companyId', window.SC.ENVIRONMENT.companyId);
    } catch (e) {
        console.log('Error while parsing generic stuff', e);
    }

    // Pull console.log elements
    try {
        const debugOP = Array.from(document.body.childNodes).filter(el => el.nodeName === '#comment').find(el => el.textContent.includes('Debug output:'));
        const text = debugOP.textContent;
        const lines = text.split('\n');
        const has404Status = lines.find(l => l.includes('[status 404]') || l.includes('[status 400]'));
        if (has404Status) {
            document.body.setAttribute('SubRequests', 'Not Ok');
        } else {
            document.body.setAttribute('SubRequests', 'OK');
        }

        const allRequests = lines.map(l => l.trim()).filter(l => l.match(/\[status \d{3}\]/g));
        document.body.setAttribute('backgroundRequests', allRequests.join(';'));

        let starsDetected = false;
        let isFirstOccurance = false;
        let isSecondOccurance = false;
        let consoleString = '';

        lines.forEach(l => {
            if (!starsDetected && l.includes('***') && !isSecondOccurance) {
                starsDetected = true;
                isFirstOccurance = true;
            }

            if (starsDetected) {
                consoleString += l + '\n';
                if (l.includes('***') && !isFirstOccurance) {
                    starsDetected = false;
                    isSecondOccurance = true;
                }
            }
        });

        let errStart = false;
        let errString = '';
        lines.forEach(l => {
            if (l.includes('Logs generated by console.log():')) {
                errStart = true;
            }

            if (l.includes('*** All requested URLs with headers (begin)')) {
                errStart = false;
            }

            if (errStart) {
                errString += l;
            }
        });

        document.body.setAttribute('consoleContent', consoleString);
        document.body.setAttribute('consoleErrStringContent', errString.trim());
    } catch (e) {
        console.log('Error while pulling console.log elements', e);
    }

    // Get Item Search details
    try {
        const traverseAndFlatten = (currentNode, target, flattenedKey) => {
            for (var key in currentNode) {
                if (currentNode.hasOwnProperty(key)) {
                    var newKey;
                    if (flattenedKey === undefined) {
                        newKey = key;
                    } else {
                        newKey = flattenedKey + '.' + key;
                    }

                    var value = currentNode[key];
                    if (typeof value === 'object') {
                        traverseAndFlatten(value, target, newKey);
                    } else {
                        target[newKey] = value;
                    }
                }
            }
        };

        const combination = {
            country: SC.ENVIRONMENT.currentLanguage.locale.split('_')[1],
            language: SC.ENVIRONMENT.currentLanguage.locale.split('_')[0],
        }
        const country = SC.ENVIRONMENT.currentHost ? SC.ENVIRONMENT.currentHost.countryCode : SC.ENVIRONMENT.siteSettings.defaultshipcountry;
        const host = SC.ENVIRONMENT.currentHostString;
        const searchTerm = 'black';
        const searchUrl = `https://${host}/api/items?country=${country || combination.country || 'US'}&&fieldset=search&language=${combination.language || 'en'}&limit=10&offset=0&q=${searchTerm}&ssdebug=T`;
        const res = await fetch(searchUrl).then(r => r.json());

        const flattenedObject = {};
        traverseAndFlatten(res.perftiming || {}, flattenedObject);
        Object.keys(flattenedObject).forEach(fo => {
            if (fo === 'sqltime') document.body.setAttribute('sqltime', flattenedObject[fo]);
            appendObjectToDom('perfTiming', flattenedObject[fo], fo, null, `${fo}:${flattenedObject[fo]}`);
        });

        document.body.setAttribute('searchrequest', res.searchrequest || '-');
    } catch (e) {
        console.log('Error while getting search details', e);
    }

    // E-Commerce identifier
    try {
        let shopifyTrue = window.Shopify;
        let suiteCommerce = window.SC;

        if (window.location.protocol.includes('s')) {
            document.body.setAttribute('isHttpS', 'Yes');
        } else {
            document.body.setAttribute('isHttpS', 'No');
        }

        const url = 'https://' + window.location.host.replace('www.', '');
        document.body.setAttribute('cNameTestWithUrl', url);

        await fetch(url)
            .then(res => {
                console.log('FETCH', res);
                document.body.setAttribute('isCNameProperlyMapped', 'Yes');
            })
            .catch(e => {
                console.log('Fetch with https to host without www failed', e);
                document.body.setAttribute('isCNameProperlyMapped', 'No');
            });

        const setECommerceType = (t) => document.body.setAttribute('eCommerceType', t);

        if (shopifyTrue) setECommerceType('Shopify');
        if (suiteCommerce) setECommerceType('NetSuite | SuiteCommerce');
    } catch (e) {
        console.log('Error while identifying e-commerce', e);
    }

    try {
        let isRobotsPagePresent = 'No';
        let isSiteMapLinkPresentInRobotsPage = 'No';
        let sitemapLink = '-';
        let isSitemapLinkFunctional = 'No';
        let sitemapOrigin = '-';
        let robotsPageContent = '-';

        const validateSitemapLink = async (l) => {
            const res = await fetch(l).catch(console.log);
            if (res.status === 200) {
                sitemapLink = l;
                return 'Yes';
            }
            return 'No';
        };

        await fetch('/robots.txt').then(res => res.text()).then(async rt => {
            isRobotsPagePresent = 'Yes';
            robotsPageContent = rt;
            if (rt.includes('Sitemap:')) {
                isSiteMapLinkPresentInRobotsPage = 'Yes';
                const regEx = /Sitemap:\s(\w.+)$/g;
                console.log(rt);
                if (regEx.test(rt)) {
                    sitemapLink = rt.match(regEx)[0].replace(regEx, '$1');
                    console.log(`Sitemap link => ${sitemapLink}`);
                    sitemapOrigin = 'External';
                    isSitemapLinkFunctional = 'Yes';
                }
            }
        }).finally(() => {
            document.body.setAttribute('isRobotsPagePresent', isRobotsPagePresent);
            document.body.setAttribute('robotsPageContent', robotsPageContent);
            document.body.setAttribute('isSiteMapLinkPresentInRobotsPage', isSiteMapLinkPresentInRobotsPage);
        });

        // Attempts to check if sitemap is present somewhere
        if (sitemapLink === '-') {
            const customLink = `https://${window.location.host}/sitemap_${window.location.host}_Index.xml`;
            console.log(`Attempting to find sitemap at -> "${customLink}"`);
            isSitemapLinkFunctional = await validateSitemapLink(customLink);
            if (isSitemapLinkFunctional === 'Yes') sitemapOrigin = 'NetSuite';
        } else if (sitemapLink === '-') {
            const customLink = `https://${window.location.host}/sitemap_index.xml`;
            console.log(`Attempting to find sitemap at -> "${customLink}"`);
            isSitemapLinkFunctional = await validateSitemapLink(customLink);
            if (isSitemapLinkFunctional === 'Yes') sitemapOrigin = 'External';
        } else if (sitemapLink === '-') {
            const customLink = `https://${window.location.host}/sitemap.xml`;
            console.log(`Attempting to find sitemap at -> "${customLink}"`);
            isSitemapLinkFunctional = await validateSitemapLink(customLink);
            if (isSitemapLinkFunctional === 'Yes') sitemapOrigin = 'External';
        }

        document.body.setAttribute('sitemapLink', sitemapLink);
        document.body.setAttribute('isSitemapLinkFunctional', isSitemapLinkFunctional);
        document.body.setAttribute('sitemapOrigin', sitemapOrigin);
    } catch (err) {
        console.log(`Something went wrong while reading robot details/getting sitemap details.`, err);
    }

    try {
        const checkGa = () => {
            if (typeof gtag === 'function') {
                return 'Yes';
            } else {
                return 'No';
            }
        };

        document.body.setAttribute('isGoogleAnalyticsLoaded', checkGa());

        // Application+LD-JSON Check
        let isApplicationLdJsonTagPresent = 'No';
        let schemaType = '-';
        let schemaMarkupPresent = 'No';

        const isLdJsonPresent = document.evaluate('//script[@type="application/ld+json"]', document).iterateNext();
        if (isLdJsonPresent) {
            isApplicationLdJsonTagPresent = 'Yes';
            schemaType = 'JSON-LD';
            schemaMarkupPresent = 'Yes';
        } else {
            const firstNonHomePageLink = Array.from(document.querySelectorAll('a')).find(a => /^\/.{1,}/g.test(a.getAttribute('href')));
            const firstNonHomePageLinkUrl = firstNonHomePageLink.href;
            let isLdJsonPresentInNonHomePagePath = '-';
            console.log(`Attempting to load => "${firstNonHomePageLinkUrl}" for application+ld.json check`);
            await fetch(firstNonHomePageLinkUrl).then(res => res.text()).then(async rt => {
                if (rt.includes('application/ld+json')) {
                    isLdJsonPresentInNonHomePagePath = 'Yes';
                    isApplicationLdJsonTagPresent = 'Yes';
                    schemaType = 'JSON-LD';
                    schemaMarkupPresent = 'Yes';
                }
            });
            document.body.setAttribute('isLdJsonPresentInNonHomePagePath', isLdJsonPresentInNonHomePagePath);
        }

        if (isApplicationLdJsonTagPresent === 'No') {
            const oldLoaderTag = document.evaluate('//*[contains(@itemtype,"https://schema.org/Web")]', document).iterateNext();
            if (oldLoaderTag) {
                schemaType = 'Microdata';
                schemaMarkupPresent = 'Yes';
            }
        }

        document.body.setAttribute('isApplicationLdJsonTagPresent', isApplicationLdJsonTagPresent);
        document.body.setAttribute('schemaType', schemaType);
        document.body.setAttribute('schemaMarkupPresent', schemaMarkupPresent);
    } catch (e) {
        console.log('Check for existance of certain tags in DOM.');
    }

    // Load webpage 3 times for different values
    try {
        let preRenderValuesSum = 0;
        let alertLevelPrerenderValues = [];

        for (let i = 0; i < 3; i++) {
            const url = window.location.href + Math.ceil((Math.random() * 2)).toString() + i.toString();
            const response = await fetch(url).then(r => r.text());
            const htmlLines = response.split('\n');

            const gotRespFromPreText = htmlLines.find(a => a.includes(gotResponseFromPrerenderString));
            const gotResponseFromPrerenderTime = gotRespFromPreText ? gotRespFromPreText.replace(/.*\[\s{1,}.(\d+)\s{1,}(ms|MS)\s{1,}\].*/, '$1') : '0';

            document.body.setAttribute(`gotResponseFromPrerenderAttempt-${i + 1}`, gotResponseFromPrerenderTime);
            preRenderValuesSum += Number(gotResponseFromPrerenderTime) || 0;

            if (Number(gotResponseFromPrerenderTime) && Number(gotResponseFromPrerenderTime) > 5000) {
                alertLevelPrerenderValues.push(gotResponseFromPrerenderTime);
            }
        }

        document.body.setAttribute(`gotResponseFromPrerenderAttempt-Average`, preRenderValuesSum / 3);
        document.body.setAttribute(`gotResponseFromPrerenderAttempt-AlertLevelValues`, alertLevelPrerenderValues.join(';') || '-');
    } catch (e) {
        console.log('Loading of a webpage multiple times failed.', e);
    }

    try {
        let analyticsType = "unknown";
        if (typeof (gtag) == "function" && gtag.toString().indexOf('ua-') != -1) {
            analyticsType = "Universal Analytics";
            console.log(`Found analytics - ${analyticsType}`);
        } else if (typeof (gtag) == "function" && gtag.toString().indexOf('g-') != -1) {
            analyticsType = "Google Analytics 4";
            console.log(`Found analytics - ${analyticsType}`);
        } else if (typeof ga !== 'undefined') {
            analyticsType = "Universal Analytics";
            console.log(`Found analytics - ${analyticsType}`);
        } else if (typeof gtag !== 'undefined') {
            analyticsType = "Google Analytics 4";
            console.log(`Found analytics - ${analyticsType}`);
        } else if (document.querySelector('[data-ga-property]')) {
            analyticsType = "Universal Analytics";
            console.log(`Found analytics - ${analyticsType}`);
        } else if (document.querySelector('[data-ga4-property]')) {
            analyticsType = "Google Analytics 4";
            console.log(`Found analytics - ${analyticsType}`);
        } else {
            try {
                var requestOptions = {
                    method: "GET",
                    redirect: "follow"
                };
                const response = await fetch(`https://www.gachecker.com/result.php?domain=${window.location.host}&i=5`, requestOptions)
                    .then(response => response.text())
                if (response.count) {
                    const firstRecord = response.data[0]?.all;
                    const interestedFields = ["Universal_Analytics", "GTM_GA_Universal_Analytics", "GTM_GA_Classic", "GA", "GTAG_Analytics"];
                    const matches = firstRecord && firstRecord.filter(fr => interestedFields.includes(fr.name) && fr.value).map(r => r.name);
                    analyticsType = matches.join(',') || analyticsType;
                }
            } catch (er) {
                console.log(`Something went wrong while making an API call to get the GTAG data.`, e);
            }
        }

        document.body.setAttribute("analyticsType", analyticsType);
    } catch (e) {
        console.log('Something went wrong while trying to read the analaytics tool values', e);
    }
}
"http://gachecker.com/csv/datadrivenu.com.csv"