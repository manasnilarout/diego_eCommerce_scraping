require('dotenv').config()
const csv = require('csvtojson');
const mysql = require("mysql");

// Database credentials
const hostname = process.env.MYSQL_HOST,
    port = process.env.MYSQL_PORT,
    username = process.env.MYSQL_USER,
    password = process.env.MYSQL_PASSWORD,
    databsename = process.env.MYSQL_DATABASE


// Establish connection to the database
let con = mysql.createConnection({
    host: hostname,
    port: port,
    user: username,
    password: password,
    database: databsename,
});

con.connect((err) => {
    if (err) return console.error('error: ' + err.message);
});

const fileName = './dt.csv';

const insertRecord = (q, v) => {
    return new Promise((res, rej) => {
        con.query(q, v,
            (err, results, fields) => {
                if (err) {
                    console.log("Unable to insert item at row ", err);
                    return rej(err);
                }
                return res(results);
            });
    });
};

const erroredIndexes = [];

const doIt = async () => {
    const startTime = new Date().getTime();
    const records = await csv()
        .fromFile(fileName);
    const insertStatement =
        `INSERT INTO suitecommerce_scraped_data.websites_data
        (uri, suitecommerce_tag, prodbundle_id, base_label, version, date_label, build_no, company_id, application_ld_json, div_id_main, div_class_main, cookies, canonical_url, title, seo_generator, got_response_from_pre_render, governance, perftiming, perftiming_sqltime, search_request_details, ssp_app_context, e_commerce_type, sub_request_status, background_requests, console_content, is_cname_mapped, cname_test_url, is_https, screen_capture, url_input, source, is_robots_page_present, is_sitemap_link_present_in_robots_page, sitemap_link, is_sitemap_link_functional, date_scraped, got_response_from_pre_render_time, div_id_footer_tag, no_index_no_follow_tags, sitemap_origin, robots_page_content, is_google_analytics_loaded, is_applicatin_ld_json_present, schema_type, schema_markup_present, is_meta_description_present, got_response_from_pre_render_val_1, got_response_from_pre_render_val_2, got_response_from_pre_render_val_3, got_response_from_pre_render_val_average, got_response_from_pre_render_val_alerts)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Import', ?, ?, ?, ?, curdate(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
    let counter = 0;
    for (const record of records) {
        const values = [
            record.url || null,
            record.suiteCommerceTag || null,
            record.prodbundle_id || null,
            record.base_label || null,
            record.version || null,
            record.date_label || null,
            record.build_no || null,
            record.companyId || null,
            record.application_ld_json || null,
            record.div_id_main || null,
            record.div_class_main || null,
            record.cookies || null,
            record.canonical_url || null,
            record.title || null,
            record.seoGenerator || null,
            record.gotResponseFromPrerender || null,
            record.Governance || null,
            record.perfTiming || null,
            record['perfTiming:sqltime'] || null,
            record.searchRequest || null,
            record.SSPAppContext || null,
            record.eCommerceType || null,
            record.subRequestStatus || null,
            record.backgroundRequests || null,
            record.consoleErrStringContent || null,
            record.isCNameProperlyMapped || null,
            record.cNameTestWithUrl || null,
            record.isHttpS || null,
            record['Screen Capture'] || null,
            record.url || null,
            record.isRobotsPagePresent || null,
            record.isSiteMapLinkPresentInRobotsPage || null,
            record.sitemapLink || null,
            record.isSitemapLinkFunctional || null,
            record.gotResponseFromPrerenderTime || null,
            record.divIdFooterTag || null,
            record.noIndexNoFollowTags || null,
            record.sitemapOrigin || null,
            record.robotsPageContent?.substring(0, 499) || null,
            record.isGoogleAnalyticsLoaded || null,
            record.isApplicationLdJsonTagPresent || null,
            record.schemaType || null,
            record.schemaMarkupPresent || null,
            record.isMetaDescriptionPresent || null,
            record['gotResponseFromPrerenderAttempt-1'] || null,
            record['gotResponseFromPrerenderAttempt-2'] || null,
            record['gotResponseFromPrerenderAttempt-3'] || null,
            record['gotResponseFromPrerenderAttempt-Average'] || null,
            record['gotResponseFromPrerenderAttempt-AlertLevelValues'] || null,
        ];

        counter++;
        try {
            console.log(`Processing line -> ${counter}`);
            await insertRecord(insertStatement, values);
        } catch (e) {
            console.log(`Processing line errored -> ${counter} -> URL : ${record.url}`);
            erroredIndexes.push(counter - 1);
        }
    }

    console.log(`Errored out indexes are -> ${erroredIndexes.join(',')}, total fails -> ${erroredIndexes.length}`);

    con.end(() => {
        const endTime = new Date().getTime();
        const totalS = (endTime - startTime) / 1000;
        console.log(`Ended DB connection, finished in ${totalS} seconds.`);
    })
};

doIt();